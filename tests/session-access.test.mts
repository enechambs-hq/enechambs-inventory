import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

// ── A browser-like environment (set up before any app module loads) ────────────────────────────────────────────────────
const store = new Map<string, string>();
const fail = { remove: false, set: false };
const nav: string[] = [];
const win = { location: { pathname: '/users', search: '?tab=perf', assign: (u: string) => void nav.push(u) } };
(globalThis as Record<string, unknown>).window = win;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { if (fail.set) throw new DOMException('quota', 'QuotaExceededError'); store.set(k, v); },
  removeItem: (k: string) => { if (fail.remove) throw new DOMException('blocked', 'SecurityError'); store.delete(k); },
};
const jar = {};
Object.defineProperty(jar, 'cookie', { get: () => (store.has('__cookie') ? `token=${store.get('__cookie')}` : ''), set: (v: string) => { if (/^token=;/.test(v)) store.delete('__cookie'); else store.set('__cookie', v.split(';')[0].slice(6)); } });
(globalThis as Record<string, unknown>).document = jar;

const { AxiosError } = await import('axios');
const { default: api, sessionExpiry } = await import('../src/lib/api.ts');
const { useAuthStore } = await import('../src/store/auth.store.ts');
const { safeReturnPath, signInUrl } = await import('../src/lib/auth/return-path.ts');
const { isSessionExpiry, createSessionExpiry } = await import('../src/lib/auth/session-expiry.ts');
const { resolveAccess } = await import('../src/lib/auth/access.ts');
const { normalizeError } = await import('../src/lib/errors/normalize.ts');
const { performLogout, LOGOUT_STORAGE_FAILED } = await import('../src/lib/admin/logout.ts');

const user = { id: 'u', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'admin', isActive: true } as never;
const signIn = (token = 'tok-1') => {
  fail.remove = fail.set = false;
  nav.length = 0;
  win.location.pathname = '/users';
  win.location.search = '?tab=perf';
  useAuthStore.getState().setAuth(user, token);
  sessionExpiry.reset();
};
const persisted = () => ({ token: store.get('token') ?? null, user: store.get('user') ?? null, cookie: store.has('__cookie'), memory: useAuthStore.getState().isAuthenticated });

/** Makes the shared client answer with a status, after the real request interceptor has attached the token. */
let seen: Array<{ url?: string; auth?: unknown }> = [];
function respondWith(status: number, data: unknown = { message: 'Unauthorized' }) {
  seen = [];
  api.defaults.adapter = async (config) => {
    seen.push({ url: config.url, auth: config.headers.Authorization });
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data });
  };
}
const call = (url: string) => api.get(url).then(() => null, (e: unknown) => e);

// ── safe return path ───────────────────────────────────────────────────────────────────────────────────────────────────
test('return path: in-app paths are kept', () => {
  for (const p of ['/users', '/users?tab=perf', '/storefront-orders/ab12?x=1#top', '/inventory']) assert.equal(safeReturnPath(p), p);
});

test('return path: anything that could leave the site or loop is rejected', () => {
  const bad = ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'http://evil.com/x', 'javascript:alert(1)', '/%2F%2Fevil.com', '/%5Cevil.com',
    '/\tevil', '/ x', '/a\nb', '', 'users', '/login', '/login?next=/x', '/login/extra', '/setup-password?token=abc', '/' + 'a'.repeat(600), '/%E0%A4%A', null, undefined, 42, {}];
  for (const p of bad) assert.equal(safeReturnPath(p), null, String(p));
  assert.equal(safeReturnPath('/login-extra'), '/login-extra', 'whole-segment match only');
});

test('sign-in address remembers a safe destination and the expired reason', () => {
  assert.equal(signInUrl(), '/login');
  assert.equal(signInUrl({ returnTo: '/users?tab=perf', expired: true }), '/login?next=%2Fusers%3Ftab%3Dperf&reason=expired');
  assert.equal(signInUrl({ returnTo: '//evil.com', expired: true }), '/login?reason=expired');
  assert.equal(signInUrl({ returnTo: '/login' }), '/login');
});

// ── what counts as an expired session ──────────────────────────────────────────────────────────────────────────────────
test('only a rejected current staff token is an expiry', () => {
  const ok = { status: 401, url: '/users', authorization: 'Bearer t' };
  const here = { token: 't', pathname: '/users' };
  assert.equal(isSessionExpiry(ok, here), true);
  assert.equal(isSessionExpiry({ ...ok, status: 403 }, here), false);
  assert.equal(isSessionExpiry({ ...ok, status: 500 }, here), false);
  for (const url of ['/auth/login', '/auth/setup-password', '/auth/validate-token', '/auth/change-password', '/auth/logout', '/auth/login?x=1']) assert.equal(isSessionExpiry({ ...ok, url }, here), false, url);
  assert.equal(isSessionExpiry({ ...ok, authorization: null }, here), false, 'request had no token');
  assert.equal(isSessionExpiry({ ...ok, authorization: 'Bearer old' }, here), false, 'late 401 for an older token');
  assert.equal(isSessionExpiry(ok, { token: null, pathname: '/users' }), false, 'no session held');
  assert.equal(isSessionExpiry(ok, { token: 't', pathname: '/login' }), false);
  assert.equal(isSessionExpiry(ok, { token: 't', pathname: '/setup-password' }), false);
});

// ── the real client: 401 on a protected request ─────────────────────────────────────────────────────────────────────────
test('protected 401: session cleared, cookie removed, one navigation to sign-in with the destination, error preserved', async () => {
  signIn();
  respondWith(401, { message: 'Unauthorized', statusCode: 401 });
  const err = (await call('/users')) as InstanceType<typeof AxiosError>;
  assert.deepEqual(seen[0].auth, 'Bearer tok-1');
  assert.deepEqual(persisted(), { token: null, user: null, cookie: false, memory: false });
  assert.deepEqual(nav, ['/login?next=%2Fusers%3Ftab%3Dperf&reason=expired']);
  // The caller still receives the original error with its response.
  assert.equal(err.response?.status, 401);
  assert.equal(normalizeError(err).kind, 'unauthenticated');
});

test('several simultaneous 401s clean up and navigate once', async () => {
  signIn();
  respondWith(401);
  await Promise.all(['/a', '/b', '/c', '/d', '/e'].map(call));
  assert.equal(nav.length, 1);
  assert.deepEqual(persisted(), { token: null, user: null, cookie: false, memory: false });
});

test('a new sign-in after an expiry is handled afresh', async () => {
  signIn('tok-1');
  respondWith(401);
  await call('/a');
  signIn('tok-2');
  respondWith(401);
  await call('/a');
  assert.equal(nav.length, 1, 'second session expiry navigates once more (nav is reset by signIn)');
});

test('a login-form 401 stays a form error: nothing cleared, no redirect, message intact', async () => {
  signIn('stale-token');
  respondWith(401, { message: 'Invalid credentials' });
  const err = (await call('/auth/login')) as InstanceType<typeof AxiosError>;
  assert.equal(nav.length, 0);
  assert.equal(persisted().memory, true);
  assert.equal((err.response?.data as { message: string }).message, 'Invalid credentials');
});

test('a wrong current password (401 from change-password) does not sign anyone out', async () => {
  signIn();
  respondWith(401, { message: 'Current password is incorrect' });
  await call('/auth/change-password');
  assert.equal(nav.length, 0);
  assert.equal(persisted().memory, true);
});

test('a 401 on the sign-in or setup-password page does nothing', async () => {
  for (const pathname of ['/login', '/setup-password']) {
    signIn();
    win.location.pathname = pathname;
    respondWith(401);
    await call('/inventory');
    assert.equal(nav.length, 0, pathname);
    assert.equal(persisted().memory, true);
  }
});

test('403 never signs out or redirects, and reads as forbidden', async () => {
  signIn();
  respondWith(403, { message: 'Forbidden resource' });
  const err = await call('/users');
  assert.equal(nav.length, 0);
  assert.deepEqual(persisted(), { token: 'tok-1', user: store.get('user') ?? null, cookie: true, memory: true });
  const app = normalizeError(err);
  assert.equal(app.kind, 'forbidden');
  assert.equal(app.retryable, false);
  assert.doesNotMatch(app.message, /Forbidden resource|admin|role/i, 'no authorization details exposed');
});

test('a request sent without a token never expires someone else\'s session', async () => {
  signIn();
  respondWith(401);
  // Simulates a request issued before sign-in: it carries no Authorization header.
  const handler = createSessionExpiry({ getToken: () => useAuthStore.getState().token, clearLocal: () => useAuthStore.getState().clearAuth(), navigate: (u) => void nav.push(u), location: () => win.location });
  assert.equal(handler.handle({ status: 401, url: '/x', authorization: null }), false);
  assert.equal(nav.length, 0);
});

// ── storage failures ───────────────────────────────────────────────────────────────────────────────────────────────────
test('removal failure: the session still ends, the cookie goes, the value is blanked, one navigation', async () => {
  signIn();
  fail.remove = true;
  respondWith(401);
  await Promise.all(['/a', '/b'].map(call));
  assert.equal(nav.length, 1);
  assert.deepEqual(persisted(), { token: '', user: '', cookie: false, memory: false });
});

test('all storage writes refused: still leaves once and does not throw; the credential remains and is reported by clearAuth', async () => {
  signIn();
  fail.remove = fail.set = true;
  respondWith(401);
  await Promise.all(['/a', '/b', '/c'].map(call));
  assert.equal(nav.length, 1);
  assert.equal(persisted().memory, false);
  assert.equal(persisted().cookie, false);
  assert.equal(persisted().token, 'tok-1', 'the limitation is real and stays visible');
  fail.remove = fail.set = false;
});

// ── Phase 3 logout is intact ───────────────────────────────────────────────────────────────────────────────────────────
test('logout: a 401 on /auth/logout is left to the logout flow, and storage failure is still reported honestly', async () => {
  signIn();
  respondWith(401);
  const notes: string[] = [];
  fail.remove = fail.set = true;
  const r = await performLogout({ remote: () => api.post('/auth/logout'), clearLocal: () => useAuthStore.getState().clearAuth(), leave: () => void nav.push('/login'), notify: (_k, m) => void notes.push(m) });
  assert.equal(nav.filter((u) => u.includes('reason=expired')).length, 0, 'no second, expiry-style cleanup or redirect');
  assert.deepEqual(nav, ['/login']);
  assert.equal(r.remoteOk, false);
  assert.equal(r.localOk, false);
  assert.equal(notes.length, 1);
  fail.remove = fail.set = false;
  void LOGOUT_STORAGE_FAILED;
});

// ── guards ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('access resolution: loading, sign-in, forbidden, allowed', () => {
  assert.equal(resolveAccess({ hydrated: false, isAuthenticated: true, role: 'admin', requiredRole: 'admin' }), 'loading');
  assert.equal(resolveAccess({ hydrated: false, isAuthenticated: false }), 'loading', 'never sign-in during loading');
  assert.equal(resolveAccess({ hydrated: true, isAuthenticated: false }), 'unauthenticated');
  assert.equal(resolveAccess({ hydrated: true, isAuthenticated: true, role: 'staff', requiredRole: 'admin' }), 'forbidden');
  assert.equal(resolveAccess({ hydrated: true, isAuthenticated: true, role: null, requiredRole: 'admin' }), 'forbidden');
  assert.equal(resolveAccess({ hydrated: true, isAuthenticated: true, role: 'admin', requiredRole: 'admin' }), 'allowed');
  assert.equal(resolveAccess({ hydrated: true, isAuthenticated: true, role: 'staff' }), 'allowed', 'no role required');
});

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('admin-only pages are withheld by their route layout, so their requests cannot start early', () => {
  for (const route of ['dashboard', 'customers', 'activity', 'purchases', 'users']) {
    const layout = `src/app/(inventory)/${route}/layout.tsx`;
    assert.ok(existsSync(new URL(`../${layout}`, import.meta.url)), layout);
    assert.match(read(layout), /<AccessGate[\s\S]*\{children\}[\s\S]*<\/AccessGate>/, layout);
    assert.doesNotMatch(read(`src/app/(inventory)/${route}/page.tsx`), /useAuthGuard/, `${route} page has no second guard`);
  }
  for (const f of ['src/components/promotions/AdminOnly.tsx', 'src/components/storefront-orders/OnlineAdminOnly.tsx']) assert.match(read(f), /<AccessGate/, f);
});

test('the shell renders nothing and sends no request until access is allowed', () => {
  const shell = read('src/components/layout/InventoryShell.tsx');
  assert.match(shell, /if \(status === 'allowed'\) api\.get\(/);
  assert.match(shell, /if \(status !== 'allowed'\) return null;/);
});

test('the guard does not sign out or loop: unauthenticated -> sign-in with return path; forbidden -> shown, no redirect', () => {
  const hook = read('src/hooks/useAuthGuard.ts');
  assert.match(hook, /status === 'unauthenticated'/);
  assert.match(hook, /signInUrl\(\{ returnTo/);
  assert.doesNotMatch(hook, /clearAuth|'\/inventory'/);
  const gate = read('src/components/auth/AccessGate.tsx');
  assert.match(gate, /status === 'allowed'/);
  assert.match(gate, /role="alert"/);
});

test('the one cleanup: the interceptor uses the store\'s clearAuth and the sign-in page validates ?next=', () => {
  const apiSrc = read('src/lib/api.ts');
  assert.match(apiSrc, /clearAuth\(\)/);
  assert.doesNotMatch(apiSrc, /removeItem|window\.location\.href/);
  assert.match(read('src/app/(auth)/login/page.tsx'), /safeReturnPath\(searchParams\.get\("next"\)\)/);
  assert.match(read('src/proxy.ts'), /signInUrl/);
});

test('a deliberate sign-out is not remembered as a destination, and being signed in clears the intent', () => {
  const hook = read('src/hooks/useAuthGuard.ts');
  assert.match(hook, /signOutIntent\.isActive\(\) \? '\/login' : signInUrl\(/);
  assert.doesNotMatch(hook, /signOutIntent\.clear/, 'only a real sign-in clears it (a re-run of the effect must not)');
  assert.match(read('src/store/auth.store.ts'), /setAuth: \(user, token\) => \{[\s\S]{0,160}signOutIntent\.clear\(\)/);
  const sidebar = read('src/components/layout/Sidebar.tsx');
  assert.equal((sidebar.match(/signOutIntent\.begin\(\)/g) ?? []).length, 2, 'logout and password-change sign-out');
});
