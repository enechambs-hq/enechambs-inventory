import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildClearCookie,
  buildSessionCookie,
  cookieMaxAgeSeconds,
  handleStoreSessionRequest,
  parseLifetime,
  type SessionAction,
} from '../src/lib/server/store-auth.ts';
import {
  SESSION_ROUTES,
  handleStoreRequest,
  redactAccessToken,
} from '../src/lib/server/store-bff.ts';

const HOST = 'shop.example.test';
const BASE = `https://${HOST}`;
const SECRET = 'test-secret-0123456789abcdef0123456789';
const ROOT = new URL('..', import.meta.url).pathname;

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (expSeconds: number) => `${b64({ alg: 'HS256' })}.${b64({ sub: 'a', exp: expSeconds })}.c2lnbmF0dXJl`;
const nowSec = () => Math.floor(Date.now() / 1000);
const TOKEN = jwt(nowSec() + 3600);

const ENV = {
  STOREFRONT_ENABLED: 'true',
  BFF_SHARED_SECRET: SECRET,
  BACKEND_URL: 'http://backend.test',
  VERCEL: '1',
  NODE_ENV: 'production',
};

interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  throws?: boolean;
}

/** A fetch double: records every call, answers with the given reply. */
function backend(reply: Reply = {}) {
  const calls: Array<{ url: string; headers: Headers; body: string }> = [];
  const f = (async (url: URL | string, init: RequestInit) => {
    calls.push({
      url: String(url),
      headers: new Headers(init.headers),
      body: init.body ? new TextDecoder().decode(init.body as Uint8Array) : '',
    });
    if (reply.throws) throw new Error('down');
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/api/store/${path}`, {
    method: 'POST',
    headers: { origin: BASE, host: HOST, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const run = (
  action: SessionAction,
  req: Request,
  reply: Reply,
  env: Record<string, string | undefined> = ENV,
) => {
  const b = backend(reply);
  return handleStoreSessionRequest(req, action, { env, fetch: b.f }).then((res) => ({
    res,
    calls: b.calls,
  }));
};

const setCookies = (res: Response) => res.headers.getSetCookie();

const LOGIN_OK = {
  accessToken: TOKEN,
  tokenType: 'Bearer',
  expiresIn: '7d',
  customer: { id: 'c1', customerName: 'Ada', customerPhone: '+2348031234567', email: 'a@b.test' },
};

// ───────────────────────────── cookie builders ───────────────────────────────

test('session cookie: HttpOnly, SameSite=Lax, Path=/, Secure in production, host-only', () => {
  const c = buildSessionCookie(TOKEN, 3600, ENV);
  assert.match(c, /^ene_cust=[A-Za-z0-9_.-]+;/);
  assert.match(c, /; HttpOnly/);
  assert.match(c, /; SameSite=Lax/);
  assert.match(c, /; Path=\//);
  assert.match(c, /; Max-Age=3600/);
  assert.match(c, /; Secure/);
  assert.doesNotMatch(c, /Domain/i); // host-only
});

test('session cookie is not Secure outside production (plain-http local development)', () => {
  assert.doesNotMatch(buildSessionCookie(TOKEN, 60, { ...ENV, NODE_ENV: 'development' }), /Secure/);
  assert.doesNotMatch(buildClearCookie({ NODE_ENV: 'development' }), /Secure/);
});

test('clear cookie has the same name, Path and (absent) Domain, and expires now', () => {
  const c = buildClearCookie(ENV);
  assert.match(c, /^ene_cust=;/);
  assert.match(c, /; Path=\//);
  assert.match(c, /; Max-Age=0/);
  assert.match(c, /Expires=Thu, 01 Jan 1970/);
  assert.match(c, /; HttpOnly/);
  assert.match(c, /; SameSite=Lax/);
  assert.match(c, /; Secure/);
  assert.doesNotMatch(c, /Domain/i);
});

test('lifetime parsing accepts the API format and nothing else', () => {
  assert.equal(parseLifetime('30m'), 1800);
  assert.equal(parseLifetime('12h'), 43200);
  assert.equal(parseLifetime('7d'), 604800);
  for (const bad of ['', '7', 'd', '7 d', '-1d', '0d', '7w', undefined, null, 5]) {
    assert.equal(parseLifetime(bad as string), null, String(bad));
  }
});

test('cookie lifetime follows the token: its exp (expired is rejected), else the reported lifetime, else 7 days, capped', () => {
  const now = Math.floor(Date.now() / 1000) * 1000; // whole seconds, so the arithmetic is exact
  assert.equal(cookieMaxAgeSeconds(jwt(Math.floor(now / 1000) + 1000), '7d', now), 1000);
  assert.equal(cookieMaxAgeSeconds('a.b.c', '12h', now), 43200); // no readable exp
  // A numeric exp is authoritative: expired or zero remaining lifetime is rejected, and
  // expiresIn must NOT bring it back to life.
  assert.equal(cookieMaxAgeSeconds(jwt(Math.floor(now / 1000) - 5), '30m', now), null);
  assert.equal(cookieMaxAgeSeconds(jwt(Math.floor(now / 1000)), '7d', now), null); // exactly now
  assert.equal(cookieMaxAgeSeconds(jwt(0), '7d', now), null);
  assert.equal(cookieMaxAgeSeconds(jwt(Math.floor(now / 1000) + 1), '7d', now), 1);
  // A non-numeric exp is not a valid claim: the reported lifetime is used.
  const oddExp = `${b64({ alg: 'HS256' })}.${b64({ exp: 'soon' })}.c2ln`;
  assert.equal(cookieMaxAgeSeconds(oddExp, '30m', now), 1800);
  assert.equal(cookieMaxAgeSeconds('a.b.c', undefined, now), 7 * 86400);
  assert.equal(cookieMaxAgeSeconds(jwt(Math.floor(now / 1000) + 10 * 86400 * 10), '7d', now), 30 * 86400);
});

// ───────────────────── login and verification: token handling ────────────────

for (const [action, path, payload] of [
  ['login', 'auth/login', { email: 'a@b.test', password: 'Sup3rSecret!' }],
  ['verify-email', 'auth/verify-email', { email: 'a@b.test', code: '123456', customerName: 'Ada', customerPhone: '08031234567', password: 'Sup3rSecret!' }],
] as const) {
  test(`${action}: the browser never receives the access token, and the HttpOnly cookie is set`, async () => {
    const { res, calls } = await run(action, post(`${path}`, payload), { status: action === 'login' ? 200 : 200, body: LOGIN_OK });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(TOKEN), 'token must not be in the body');
    assert.ok(!text.includes('accessToken'), 'no accessToken key');
    assert.deepEqual(JSON.parse(text).customer, LOGIN_OK.customer);

    const cookies = setCookies(res);
    assert.equal(cookies.length, 1);
    assert.match(cookies[0], new RegExp(`^ene_cust=${TOKEN.replace(/\./g, '\\.')};`));
    assert.match(cookies[0], /HttpOnly/);
    assert.equal(res.headers.get('cache-control'), 'no-store');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `http://backend.test/api/v1/storefront/${path}`);
    assert.deepEqual(JSON.parse(calls[0].body), payload); // forwarded exactly
  });

  test(`${action}: failure statuses set no cookie and relay the status`, async () => {
    for (const [status, retry] of [[400, undefined], [401, undefined], [403, undefined], [409, undefined], [429, '120'], [503, undefined]] as const) {
      const { res } = await run(action, post(path, payload), {
        status,
        body: { message: 'nope', code: 'X' },
        headers: retry ? { 'retry-after': retry } : {},
      });
      assert.equal(res.status, status, String(status));
      assert.deepEqual(setCookies(res), [], `no cookie on ${status}`);
      assert.equal((await res.json()).message, 'nope');
      if (retry) assert.equal(res.headers.get('retry-after'), retry);
    }
  });

  test(`${action}: a success response without a well-formed token sets no cookie`, async () => {
    for (const body of [{ customer: {} }, { accessToken: 'not-a-jwt' }, { accessToken: 12345 }, { accessToken: '' }]) {
      const { res } = await run(action, post(path, payload), { body });
      assert.deepEqual(setCookies(res), []);
      assert.ok(!(await res.text()).includes('not-a-jwt'));
    }
  });

  test(`${action}: an upstream Set-Cookie is never forwarded`, async () => {
    const { res } = await run(action, post(path, payload), {
      body: LOGIN_OK,
      headers: { 'set-cookie': 'evil=1; Domain=.example.test; Path=/' },
    });
    const cookies = setCookies(res);
    assert.equal(cookies.length, 1);
    assert.ok(!cookies[0].includes('evil'));
    assert.ok(!cookies[0].includes('Domain'));
    // and on failure too
    const failed = await run(action, post(path, payload), {
      status: 401,
      body: { message: 'x' },
      headers: { 'set-cookie': 'evil=1' },
    });
    assert.deepEqual(setCookies(failed.res), []);
  });

  test(`${action}: a token mistakenly present in a failure body is not relayed`, async () => {
    const { res } = await run(action, post(path, payload), {
      status: 400,
      body: { message: 'x', accessToken: TOKEN },
    });
    assert.ok(!(await res.text()).includes(TOKEN));
  });

  test(`${action}: CSRF and BFF checks still apply, and a refused request never touches the cookie`, async () => {
    const cases: Array<[string, Request, number]> = [
      ['cross-site origin', post(path, payload, { origin: 'https://evil.example' }), 403],
      ['no origin', new Request(`${BASE}/api/store/${path}`, { method: 'POST', headers: { host: HOST, 'content-type': 'application/json' }, body: '{}' }), 403],
      ['not json', post(path, payload, { 'content-type': 'text/plain' }), 415],
    ];
    for (const [label, req, status] of cases) {
      const { res, calls } = await run(action, req, { body: LOGIN_OK });
      assert.equal(res.status, status, label);
      assert.equal(calls.length, 0, `${label}: backend not contacted`);
      assert.deepEqual(setCookies(res), [], label);
    }
  });

  test(`${action}: flag off is a 404 with no cookie and no backend call`, async () => {
    const { res, calls } = await run(action, post(path, payload), { body: LOGIN_OK }, { ...ENV, STOREFRONT_ENABLED: 'false' });
    assert.equal(res.status, 404);
    assert.deepEqual(setCookies(res), []);
    assert.equal(calls.length, 0);
  });

  test(`${action}: a browser Authorization header is ignored; only the customer cookie derives it`, async () => {
    const a = await run(action, post(path, payload, { authorization: 'Bearer attacker.token.here' }), { body: LOGIN_OK });
    assert.equal(a.calls[0].headers.get('authorization'), null);
    const b = await run(action, post(path, payload, { authorization: 'Bearer attacker.token.here', cookie: `ene_cust=${TOKEN}` }), { body: LOGIN_OK });
    assert.equal(b.calls[0].headers.get('authorization'), `Bearer ${TOKEN}`);
  });

  test(`${action}: the staff cookie is never read or forwarded`, async () => {
    const staff = 'eyJzdGFm.ZnRva2Vu.c3RhZmY';
    const { calls } = await run(action, post(path, payload, { cookie: `token=${staff}` }), { body: LOGIN_OK });
    assert.equal(calls[0].headers.get('authorization'), null);
    assert.equal(calls[0].headers.get('cookie'), null);
    assert.ok(![...calls[0].headers.values()].some((v) => v.includes(staff)));
  });
}

for (const action of ['login', 'verify-email'] as const) {
  test(`${action}: a token that is already expired is refused: no cookie, safe error, token not relayed`, async () => {
    for (const exp of [nowSec() - 60, nowSec(), 0]) {
      const dead = jwt(exp);
      const { res } = await run(action, post(`auth/${action}`, {}), {
        body: { ...LOGIN_OK, accessToken: dead, expiresIn: '7d' }, // expiresIn must not rescue it
      });
      assert.equal(res.status, 502, String(exp));
      assert.deepEqual(setCookies(res), [], String(exp));
      const text = await res.text();
      assert.ok(!text.includes(dead));
      assert.ok(!text.includes('accessToken'));
      assert.match(JSON.parse(text).message, /session/i);
    }
  });
}

// ───────────────────────────────── logout ────────────────────────────────────

test('logout: revokes on the backend with the cookie token and clears the same cookie', async () => {
  const { res, calls } = await run('logout', post('auth/logout', {}, { cookie: `ene_cust=${TOKEN}` }), { body: { message: 'Signed out' } });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://backend.test/api/v1/storefront/auth/logout');
  assert.equal(calls[0].headers.get('authorization'), `Bearer ${TOKEN}`);
  const cookies = setCookies(res);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0], buildClearCookie(ENV));
});

test('logout: an already-invalid token (401) still signs the browser out', async () => {
  const { res } = await run('logout', post('auth/logout', {}, { cookie: `ene_cust=${TOKEN}` }), { status: 401, body: { message: 'x' } });
  assert.equal(res.status, 200);
  assert.deepEqual(setCookies(res), [buildClearCookie(ENV)]);
});

test('logout: if the backend is unreachable the cookie is still cleared, and the failure is reported', async () => {
  const { res } = await run('logout', post('auth/logout', {}, { cookie: `ene_cust=${TOKEN}` }), { throws: true });
  assert.equal(res.status, 502);
  assert.deepEqual(setCookies(res), [buildClearCookie(ENV)]);
});

test('logout: a forged cross-site request cannot clear the cookie or reach the backend', async () => {
  const { res, calls } = await run('logout', post('auth/logout', {}, { origin: 'https://evil.example', cookie: `ene_cust=${TOKEN}` }), {});
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
  assert.deepEqual(setCookies(res), []);
});

// ─────────────── the catch-all cannot be used to bypass the handlers ─────────

test('the generic catch-all refuses the session routes, whatever the browser asks for', async () => {
  assert.deepEqual([...SESSION_ROUTES].sort(), [
    'storefront/auth/login',
    'storefront/auth/logout',
    'storefront/auth/verify-email',
  ]);
  for (const route of SESSION_ROUTES) {
    const b = backend({ body: LOGIN_OK });
    const res = await handleStoreRequest(post(`${route}`, {}), route.split('/'), { env: ENV, fetch: b.f });
    assert.equal(res.status, 404, route);
    assert.equal(b.calls.length, 0, `${route}: backend never contacted`);
    assert.ok(!(await res.text()).includes(TOKEN));
  }
});

test('the generic catch-all still carries registration, recovery and /me, with no token in any response', async () => {
  for (const [method, route] of [
    ['POST', 'storefront/auth/register'],
    ['POST', 'storefront/auth/resend-code'],
    ['POST', 'storefront/auth/forgot-password'],
    ['POST', 'storefront/auth/reset-password'],
    ['GET', 'storefront/auth/me'],
  ] as const) {
    const b = backend({ body: { message: 'ok', accessToken: TOKEN } }); // even a misbehaving backend
    const req =
      method === 'GET'
        ? new Request(`${BASE}/api/store/${route}`, { headers: { host: HOST, cookie: `ene_cust=${TOKEN}` } })
        : post(route, { email: 'a@b.test' });
    const res = await handleStoreRequest(req, route.split('/'), { env: ENV, fetch: b.f });
    assert.equal(res.status, 200, route);
    assert.equal(b.calls.length, 1, route);
    const text = await res.text();
    assert.ok(!text.includes(TOKEN), `${route}: token redacted`);
    assert.deepEqual(res.headers.getSetCookie(), []);
  }
});

test('redactAccessToken removes the key from JSON and leaves other bodies alone', () => {
  const enc = (v: string) => new TextEncoder().encode(v).buffer as ArrayBuffer;
  const dec = (b: ArrayBuffer) => new TextDecoder().decode(b);
  assert.deepEqual(JSON.parse(dec(redactAccessToken(enc('{"a":1,"accessToken":"x"}'), 'application/json'))), { a: 1 });
  assert.equal(dec(redactAccessToken(enc('{"a":1}'), 'application/json')), '{"a":1}');
  assert.equal(dec(redactAccessToken(enc('accessToken plain text'), 'text/plain')), 'accessToken plain text');
  assert.ok(!dec(redactAccessToken(enc('{"accessToken":"x" broken'), 'application/json')).includes('"x"'));
});

// ───────────────────── routes, precedence and staff separation ───────────────

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('each dedicated route is a POST-only wrapper at its own static path, which beats the catch-all', () => {
  for (const action of ['login', 'verify-email', 'logout']) {
    const file = `src/app/api/store/auth/${action}/route.ts`;
    const src = code(file);
    assert.match(src, /export async function POST\(/, file);
    assert.doesNotMatch(src, /export (const|async function) (GET|PUT|PATCH|DELETE)\b/, file);
    assert.match(src, new RegExp(`handleStoreSessionRequest\\(req, '${action}'`), file);
  }
  // Static segments (api/store/auth/...) are more specific than [...path].
  assert.ok(read('src/app/api/store/[...path]/route.ts').includes('handleStoreRequest'));
});

test('the catch-all passes no allowSessionRoutes option (so it cannot serve the session routes)', () => {
  assert.doesNotMatch(code('src/app/api/store/[...path]/route.ts'), /allowSessionRoutes/);
  const dedicated = ['login', 'verify-email', 'logout'].map((a) => code(`src/app/api/store/auth/${a}/route.ts`));
  for (const src of dedicated) assert.doesNotMatch(src, /allowSessionRoutes/); // set inside store-auth.ts only
});

test('customer session code never touches staff authentication', () => {
  const src = code('src/lib/server/store-auth.ts');
  assert.doesNotMatch(src, /localStorage|AuthProvider|useAuth|axios/);
  assert.doesNotMatch(src, /['"`]token['"`]/); // the staff cookie name
  assert.doesNotMatch(src, /\/api\/v1\//); // the admin proxy namespace
  for (const action of ['login', 'verify-email', 'logout']) {
    const route = code(`src/app/api/store/auth/${action}/route.ts`);
    assert.doesNotMatch(route, /api\/v1|['"`]token['"`]/);
  }
  // and the admin proxy knows nothing about the customer BFF
  const admin = read('src/app/api/v1/[...path]/route.ts');
  assert.doesNotMatch(admin, /store-auth|ene_cust|CUSTOMER_COOKIE/);
  assert.doesNotMatch(read('src/proxy.ts'), /ene_cust|store-auth/);
});

test('no browser-reachable code reads the customer cookie or token (it is HttpOnly and server-only)', () => {
  const clientFiles = ['src/lib/storefront/catalogue-client.ts'];
  for (const f of clientFiles) assert.doesNotMatch(read(f), /ene_cust|accessToken|document\.cookie/);
});
