import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BFF_AUTH_SIGNATURE_HEADER,
  BFF_AUTH_TIMESTAMP_HEADER,
  BFF_AUTH_VERSION_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  bffAuthHeaders,
  bodyDigestHex,
  deriveBffAuthKey,
  signBffRequest,
} from '../src/lib/server/bff.ts';
import { handleStoreRequest } from '../src/lib/server/store-bff.ts';
import { handleStoreSessionRequest } from '../src/lib/server/store-auth.ts';

const HOST = 'shop.example.test';
const BASE = `https://${HOST}`;
const SECRET = 'test-secret-0123456789abcdef0123456789';
const ROOT = new URL('..', import.meta.url).pathname;
const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'a', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;

const ENV = {
  STOREFRONT_ENABLED: 'true',
  BFF_SHARED_SECRET: SECRET,
  BACKEND_URL: 'http://backend.test',
  VERCEL: '1',
  NODE_ENV: 'production',
};

// ── golden vectors, identical to the API's bff-request-signature.spec.ts ──────
const TS = 1790000000000;
const VECTORS = [
  {
    method: 'POST',
    path: '/api/v1/storefront/auth/login',
    body: '{"email":"ada@example.com","password":"Sup3rSecret!"}',
    digest: 'f3ee6b823aa762329cadcdff8ebf509fb814d14750eada43049f905c934c21d6',
    signature: '466085c11214ec90580a47d9cbf22704421eba860958484d95f0a4517d4571d2',
  },
  {
    method: 'GET',
    path: '/api/v1/storefront/auth/me',
    body: '',
    digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signature: '6151c8fd249eebc8c6f8d1824f094e9f94142d5ac92242a3cedf7249783bfcd2',
  },
  {
    method: 'POST',
    path: '/api/v1/storefront/auth/verify-email',
    body: '{"customerName":"Ọlá Ñ","code":"123456"}',
    digest: 'be5ba36d3d84ebf39a7c1ea5e7098021e1b8d932d36359371edc242922a46da4',
    signature: '0e09fee4c894c82fd04bffca4444b435164f482d0d55f8cc200f314e10744f18',
  },
];

for (const v of VECTORS) {
  test(`request signature matches the API's golden vector: ${v.method} ${v.path}`, () => {
    assert.equal(bodyDigestHex(enc(v.body)), v.digest);
    assert.equal(
      signBffRequest({ secret: SECRET, method: v.method, path: v.path, timestampMs: TS, body: enc(v.body) }),
      v.signature,
    );
  });
}

test('an absent body and an empty body sign identically; the method is case-insensitive', () => {
  const a = signBffRequest({ secret: SECRET, method: 'get', path: '/p', timestampMs: TS });
  const b = signBffRequest({ secret: SECRET, method: 'GET', path: '/p', timestampMs: TS, body: new Uint8Array(0) });
  assert.equal(a, b);
});

test('the request key is derived, so the raw secret (which signs client IPs) is not the key', () => {
  assert.notEqual(deriveBffAuthKey(SECRET).toString('utf8'), SECRET);
  assert.equal(deriveBffAuthKey(SECRET).length, 32);
});

test('bffAuthHeaders emits version, timestamp and a 64-hex signature', () => {
  const h = bffAuthHeaders({ secret: SECRET, method: 'POST', path: '/p', body: enc('{}'), nowMs: TS });
  assert.deepEqual(h, {
    [BFF_AUTH_VERSION_HEADER]: 'v1',
    [BFF_AUTH_TIMESTAMP_HEADER]: String(TS),
    [BFF_AUTH_SIGNATURE_HEADER]: signBffRequest({ secret: SECRET, method: 'POST', path: '/p', timestampMs: TS, body: enc('{}') }),
  });
  assert.match(h[BFF_AUTH_SIGNATURE_HEADER], /^[0-9a-f]{64}$/);
});

// ── the handlers sign what they actually forward ──────────────────────────────

interface Call {
  url: URL;
  method: string;
  headers: Headers;
  body: Uint8Array | undefined;
}
function backend(reply: { status?: number; body?: unknown } = {}) {
  const calls: Call[] = [];
  const f = (async (url: URL | string, init: RequestInit) => {
    calls.push({
      url: new URL(String(url)),
      method: String(init.method),
      headers: new Headers(init.headers),
      body: init.body as Uint8Array | undefined,
    });
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const post = (path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/api/store/${path}`, {
    method: 'POST',
    headers: { origin: BASE, host: HOST, 'content-type': 'application/json', ...headers },
    body,
  });

/** Recomputes the signature from what the "backend" actually received. */
function recompute(call: Call): string {
  return signBffRequest({
    secret: SECRET,
    method: call.method,
    path: call.url.pathname,
    timestampMs: Number(call.headers.get(BFF_AUTH_TIMESTAMP_HEADER)),
    body: call.body,
  });
}

const LOGIN_BODY = JSON.stringify({ email: 'a@b.test', password: 'Sup3rSecret!' });
const LOGIN_OK = { accessToken: JWT, expiresIn: '7d', customer: { id: 'c1', customerName: 'Ada' } };

for (const action of ['login', 'verify-email'] as const) {
  test(`${action}: the upstream request carries a valid signature over the exact forwarded bytes`, async () => {
    const b = backend({ body: LOGIN_OK });
    await handleStoreSessionRequest(post(`auth/${action}`, LOGIN_BODY), action, { env: ENV, fetch: b.f });
    assert.equal(b.calls.length, 1);
    const call = b.calls[0];
    assert.equal(call.headers.get(BFF_AUTH_VERSION_HEADER), 'v1');
    assert.match(call.headers.get(BFF_AUTH_SIGNATURE_HEADER) ?? '', /^[0-9a-f]{64}$/);
    assert.equal(call.url.pathname, `/api/v1/storefront/auth/${action}`);
    assert.equal(call.method, 'POST');
    assert.equal(new TextDecoder().decode(call.body), LOGIN_BODY);
    assert.equal(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), recompute(call));
    assert.ok(Math.abs(Date.now() - Number(call.headers.get(BFF_AUTH_TIMESTAMP_HEADER))) < 5000);
  });
}

test('the signature is over the bytes received, not a re-serialisation: odd whitespace and unicode survive intact', async () => {
  const odd = '{ "email" :  "a@b.test",\n\t"password":"Ünï ✓ ọ́" }';
  const compact = JSON.stringify(JSON.parse(odd));
  assert.notEqual(odd, compact);
  const b = backend({ body: LOGIN_OK });
  await handleStoreSessionRequest(post('auth/login', odd), 'login', { env: ENV, fetch: b.f });
  const call = b.calls[0];
  assert.equal(new TextDecoder().decode(call.body), odd, 'forwarded unchanged');
  assert.equal(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), recompute(call));
  // A signature over the re-serialised JSON would not have matched these bytes:
  const wrong = signBffRequest({
    secret: SECRET, method: 'POST', path: call.url.pathname,
    timestampMs: Number(call.headers.get(BFF_AUTH_TIMESTAMP_HEADER)), body: enc(compact),
  });
  assert.notEqual(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), wrong);
});

test('the generic route signs every storefront/auth request (register, recovery, me) with the right method, path and body', async () => {
  const cases: Array<[string, string, string | undefined]> = [
    ['POST', 'storefront/auth/register', '{"email":"a@b.test"}'],
    ['POST', 'storefront/auth/resend-code', '{"email":"a@b.test"}'],
    ['POST', 'storefront/auth/forgot-password', '{"email":"a@b.test"}'],
    ['POST', 'storefront/auth/reset-password', '{"email":"a@b.test","code":"123456","newPassword":"Br4ndNew!"}'],
    ['GET', 'storefront/auth/me', undefined],
  ];
  for (const [method, route, body] of cases) {
    const b = backend({ body: { message: 'ok' } });
    const req =
      method === 'GET'
        ? new Request(`${BASE}/api/store/${route}`, { headers: { host: HOST, cookie: `ene_cust=${JWT}` } })
        : post(route, body as string);
    const res = await handleStoreRequest(req, route.split('/'), { env: ENV, fetch: b.f });
    assert.equal(res.status, 200, route);
    const call = b.calls[0];
    assert.equal(call.method, method, route);
    assert.equal(call.url.pathname, `/api/v1/${route}`);
    assert.equal(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), recompute(call), route);
    if (method === 'GET') {
      assert.equal(bodyDigestHex(call.body), VECTORS[1].digest); // the empty-body digest
      assert.equal(call.headers.get('authorization'), `Bearer ${JWT}`); // cookie-derived auth still works
    }
  }
});

test('logout is signed too, over the forwarded JSON body', async () => {
  const b = backend({ body: { message: 'Signed out' } });
  await handleStoreSessionRequest(post('auth/logout', '{}', { cookie: `ene_cust=${JWT}` }), 'logout', { env: ENV, fetch: b.f });
  const call = b.calls[0];
  assert.equal(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), recompute(call));
  assert.equal(call.headers.get('authorization'), `Bearer ${JWT}`);
});

test('non-auth storefront requests are NOT given the request signature (it is only for the auth namespace)', async () => {
  const b = backend({ body: { data: [] } });
  await handleStoreRequest(new Request(`${BASE}/api/store/storefront/combos`, { headers: { host: HOST } }), ['storefront', 'combos'], { env: ENV, fetch: b.f });
  assert.equal(b.calls[0].headers.get(BFF_AUTH_SIGNATURE_HEADER), null);
  assert.equal(b.calls[0].headers.get(BFF_AUTH_VERSION_HEADER), null);
  // ...while the existing client-IP signature is untouched and still sent
  assert.ok(b.calls[0].headers.get(CLIENT_IP_SIGNATURE_HEADER) === null || /^[0-9a-f]{64}$/.test(b.calls[0].headers.get(CLIENT_IP_SIGNATURE_HEADER)!));
});

test('the client-IP signature mechanism is intact and separate from the request signature', async () => {
  const b = backend({ body: LOGIN_OK });
  await handleStoreSessionRequest(
    post('auth/login', LOGIN_BODY, { 'x-forwarded-for': '203.0.113.7' }), 'login', { env: ENV, fetch: b.f },
  );
  const h = b.calls[0].headers;
  assert.equal(h.get('x-bff-client-ip'), '203.0.113.7');
  assert.match(h.get('x-bff-signature') ?? '', /^[0-9a-f]{64}$/);
  assert.notEqual(h.get('x-bff-signature'), h.get(BFF_AUTH_SIGNATURE_HEADER)); // different MACs
});

test('a browser cannot inject or override the request-signature headers; the BFF always supplies its own', async () => {
  const forged = 'f'.repeat(64);
  const b = backend({ body: LOGIN_OK });
  await handleStoreSessionRequest(
    post('auth/login', LOGIN_BODY, {
      [BFF_AUTH_SIGNATURE_HEADER]: forged,
      [BFF_AUTH_TIMESTAMP_HEADER]: '1',
      [BFF_AUTH_VERSION_HEADER]: 'v0',
    }),
    'login',
    { env: ENV, fetch: b.f },
  );
  const call = b.calls[0];
  assert.notEqual(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), forged);
  assert.equal(call.headers.get(BFF_AUTH_VERSION_HEADER), 'v1');
  assert.equal(call.headers.get(BFF_AUTH_SIGNATURE_HEADER), recompute(call));
});

// ── nothing secret, and no token, reaches the browser ─────────────────────────

test('signing material and the token never appear in any browser-bound response', async () => {
  const scenarios: Array<[string, () => Promise<Response>]> = [];
  for (const action of ['login', 'verify-email'] as const) {
    for (const status of [200, 400, 401, 429, 503]) {
      scenarios.push([`${action} ${status}`, async () => {
        const b = backend({ status, body: status === 200 ? LOGIN_OK : { message: 'nope' } });
        const res = await handleStoreSessionRequest(post(`auth/${action}`, LOGIN_BODY), action, { env: ENV, fetch: b.f });
        // what the BFF sent upstream is sensitive too: collect it for the check below
        lastUpstream = b.calls[0];
        return res;
      }]);
    }
  }
  let lastUpstream: Call | undefined;
  for (const [label, run] of scenarios) {
    const res = await run();
    const upstreamSignature = lastUpstream!.headers.get(BFF_AUTH_SIGNATURE_HEADER)!;
    const everything = [
      await res.clone().text(),
      JSON.stringify([...res.headers.entries()]),
      res.headers.getSetCookie().join('\n'),
    ].join('\n');
    for (const secret of [SECRET, deriveBffAuthKey(SECRET).toString('hex'), upstreamSignature, BFF_AUTH_SIGNATURE_HEADER]) {
      assert.ok(!everything.includes(secret), `${label}: leaked ${secret.slice(0, 8)}…`);
    }
    // The JWT only ever appears inside the HttpOnly cookie, never in a body or other header.
    const bodyAndHeaders = [await res.clone().text(), JSON.stringify([...res.headers.entries()].filter(([k]) => k !== 'set-cookie'))].join('\n');
    assert.ok(!bodyAndHeaders.includes(JWT), `${label}: token leaked outside the cookie`);
  }
});

test('success still sets the HttpOnly cookie, and failure still sets none (with signing in place)', async () => {
  const ok = backend({ body: LOGIN_OK });
  const good = await handleStoreSessionRequest(post('auth/login', LOGIN_BODY), 'login', { env: ENV, fetch: ok.f });
  const cookies = good.headers.getSetCookie();
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /^ene_cust=/);
  assert.match(cookies[0], /HttpOnly/);
  assert.ok(!(await good.text()).includes('accessToken'));

  for (const status of [400, 401, 403, 429]) {
    const bad = backend({ status, body: { message: 'no' } });
    const res = await handleStoreSessionRequest(post('auth/login', LOGIN_BODY), 'login', { env: ENV, fetch: bad.f });
    assert.deepEqual(res.headers.getSetCookie(), [], String(status));
  }
});

test('cross-origin requests are still refused before anything is signed or sent', async () => {
  for (const origin of ['https://evil.example', undefined]) {
    const b = backend({ body: LOGIN_OK });
    const headers: Record<string, string> = { host: HOST, 'content-type': 'application/json' };
    if (origin) headers.origin = origin;
    const res = await handleStoreSessionRequest(
      new Request(`${BASE}/api/store/auth/login`, { method: 'POST', headers, body: LOGIN_BODY }),
      'login',
      { env: ENV, fetch: b.f },
    );
    assert.equal(res.status, 403);
    assert.equal(b.calls.length, 0);
    assert.deepEqual(res.headers.getSetCookie(), []);
  }
});

test('a missing BFF secret refuses to send anything (503), rather than sending unsigned', async () => {
  const b = backend({ body: LOGIN_OK });
  const res = await handleStoreSessionRequest(post('auth/login', LOGIN_BODY), 'login', {
    env: { ...ENV, BFF_SHARED_SECRET: undefined }, fetch: b.f,
  });
  assert.equal(res.status, 503);
  assert.equal(b.calls.length, 0);
});

// ── the secret stays on the server; staff handling is untouched ───────────────

const files = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const full = join(dir, name);
    return statSync(join(ROOT, full)).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
const code = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('the signing secret is only ever referenced by server-side code', () => {
  const usesSecret = files('src').filter((f) => /BFF_SHARED_SECRET|bffAuthHeaders|signBffRequest|deriveBffAuthKey/.test(code(f)));
  assert.ok(usesSecret.length > 0);
  for (const f of usesSecret) {
    assert.match(f, /^src\/(lib\/server\/|app\/api\/)/, `${f} must be server-only`);
    assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /^['"]use client['"]/m, f);
  }
  for (const f of files('src')) {
    assert.doesNotMatch(code(f), /NEXT_PUBLIC_[A-Z_]*(BFF|SECRET)/, `${f}: no secret in a public variable`);
  }
  // nothing under components/, hooks/ or the browser catalogue client touches it
  for (const f of [...files('src/components'), ...files('src/hooks'), 'src/lib/storefront/catalogue-client.ts']) {
    assert.doesNotMatch(code(f), /bff\.ts|bff'|server\/bff|BFF_SHARED_SECRET/, f);
  }
});

test('staff session handling is unchanged: the admin proxy and proxy.ts know nothing of request signing', () => {
  const admin = code('src/app/api/v1/[...path]/route.ts');
  assert.doesNotMatch(admin, /bffAuthHeaders|x-bff-auth|BFF_SHARED_SECRET|ene_cust|store-auth|store-bff/);
  assert.doesNotMatch(code('src/proxy.ts'), /bffAuthHeaders|x-bff-auth|ene_cust/);
  assert.doesNotMatch(code('src/lib/server/store-auth.ts'), /['"`]token['"`]|\/api\/v1\/(auth|users|inventory)/);
});
