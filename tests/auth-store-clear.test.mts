import assert from 'node:assert/strict';
import { test } from 'node:test';

/** A browser-like environment whose storage can be told to fail, set up before the store module is loaded. */
const store = new Map<string, string>();
const fail = { remove: false, set: false, get: false };
const jar = { cookie: '' };
(globalThis as Record<string, unknown>).window = {};
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => { if (fail.get) throw new Error('blocked'); return store.get(k) ?? null; },
  setItem: (k: string, v: string) => { if (fail.set) throw new DOMException('quota', 'QuotaExceededError'); store.set(k, v); },
  removeItem: (k: string) => { if (fail.remove) throw new DOMException('insecure', 'SecurityError'); store.delete(k); },
};
// A minimal cookie jar: "token=...; ..." sets it, "token=; max-age=0" removes it.
Object.defineProperty(jar, 'cookie', { get: () => (store.has('__cookie') ? `token=${store.get('__cookie')}` : ''), set: (v: string) => { if (/^token=;/.test(v)) store.delete('__cookie'); else store.set('__cookie', v.split(';')[0].slice(6)); } });
(globalThis as Record<string, unknown>).document = jar;

const { useAuthStore } = await import('../src/store/auth.store.ts');
const user = { id: 'u', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'admin', isActive: true } as never;
const signIn = () => {
  fail.remove = fail.set = fail.get = false;
  useAuthStore.getState().setAuth(user, 'tok-123');
};
const state = () => ({ auth: useAuthStore.getState().isAuthenticated, token: useAuthStore.getState().token, persistedToken: store.get('token') ?? null, persistedUser: store.get('user') ?? null, cookie: store.has('__cookie') });

test('storage works: everything is cleared and the caller is told so', () => {
  signIn();
  assert.equal(useAuthStore.getState().clearAuth(), true);
  assert.deepEqual(state(), { auth: false, token: null, persistedToken: null, persistedUser: null, cookie: false });
});

test('removeItem fails: memory and cookie are still cleared, and the saved values are blanked so they no longer read as a session', () => {
  signIn();
  fail.remove = true;
  assert.equal(useAuthStore.getState().clearAuth(), true);
  assert.deepEqual(state(), { auth: false, token: null, persistedToken: '', persistedUser: '', cookie: false });
});

test('storage cannot be modified at all: memory and cookie are cleared, but the caller is told the credential may remain', () => {
  signIn();
  fail.remove = true;
  fail.set = true;
  assert.equal(useAuthStore.getState().clearAuth(), false);
  const s = state();
  assert.equal(s.auth, false, 'the in-memory session is gone');
  assert.equal(s.cookie, false, 'the cookie is gone');
  assert.equal(s.persistedToken, 'tok-123', 'the persisted credential could not be removed (a browser limitation)');
});

test('storage cannot even be read: nothing can be read back by the app either, and the session is cleared', () => {
  signIn();
  fail.remove = true;
  fail.set = true;
  fail.get = true;
  assert.equal(useAuthStore.getState().clearAuth(), true);
  assert.equal(state().auth, false);
});

test('clearing twice, or when signed out, is harmless', () => {
  signIn();
  useAuthStore.getState().clearAuth();
  assert.equal(useAuthStore.getState().clearAuth(), true);
});
