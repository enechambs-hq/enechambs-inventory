import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { register } from 'node:module';
import { createCombosApi, type HttpClient } from '../src/lib/combos/combos-api.ts';

// The route imports 'next/server', which bundlers resolve but Node's ESM loader
// does not (Next ships it as CommonJS without an extension map). This one-line
// resolve hook lets the REAL route file load unchanged under node:test.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function resolve(s,c,n){return n(s==='next/server'?'next/server.js':s,c)}",
    ),
  import.meta.url,
);
const { NextRequest } = await import('next/server.js');
const { DELETE, GET, PATCH, POST } = await import('../src/app/api/v1/[...path]/route.ts');

/**
 * Exercises the real route handlers. Only the network edge (global fetch to the
 * backend) is replaced, and restored after each test.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Upstream {
  status: number;
  body?: string | null;
  headers?: Record<string, string>;
}

function stubBackend(...answers: Upstream[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const a = answers.shift() as Upstream;
    // Bytes, not a string: a string body would make Response invent a text/plain Content-Type.
    return new Response(a.body == null ? null : new TextEncoder().encode(a.body), { status: a.status, headers: a.headers });
  }) as typeof fetch;
  return calls;
}

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (method: string, url: string, init: { headers?: Record<string, string>; body?: string } = {}) =>
  new NextRequest(`http://admin.test${url}`, { method, ...init });

// ── body-forbidden statuses ───────────────────────────────────────────────────
for (const status of [204, 205, 304]) {
  test(`upstream ${status} is returned as ${status} with no body`, async () => {
    stubBackend({ status, headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', connection: 'keep-alive' } });
    const res = await DELETE(req('DELETE', '/api/v1/admin/combos/c/images/i'), ctx('admin', 'combos', 'c', 'images', 'i'));
    assert.equal(res.status, status);
    assert.equal(res.body, null);
    assert.equal(await res.text(), '');
  });
}

test('null-body responses keep Content-Type and cache validators but drop hop-by-hop headers', async () => {
  stubBackend({
    status: 304,
    headers: { 'content-type': 'application/json', etag: '"abc"', 'cache-control': 'no-cache', connection: 'close', 'keep-alive': 'timeout=5' },
  });
  const res = await GET(req('GET', '/api/v1/x'), ctx('x'));
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('etag'), '"abc"');
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.equal(res.headers.get('connection'), null);
  assert.equal(res.headers.get('keep-alive'), null);
});

test('a 204 without a Content-Type does not invent one', async () => {
  stubBackend({ status: 204 });
  const res = await DELETE(req('DELETE', '/api/v1/x'), ctx('x'));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('content-type'), null);
});

// ── everything else is unchanged ──────────────────────────────────────────────
test('a 200 JSON response keeps its status, body and Content-Type', async () => {
  stubBackend({ status: 200, body: '{"data":[1,2]}', headers: { 'content-type': 'application/json; charset=utf-8' } });
  const res = await GET(req('GET', '/api/v1/admin/combos?page=2'), ctx('admin', 'combos'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.deepEqual(await res.json(), { data: [1, 2] });
});

test('a 201 keeps its body', async () => {
  stubBackend({ status: 201, body: '{"id":"n"}', headers: { 'content-type': 'application/json' } });
  const res = await POST(req('POST', '/api/v1/admin/combos', { body: '{"name":"x"}', headers: { 'content-type': 'application/json' } }), ctx('admin', 'combos'));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { id: 'n' });
});

test('a backend 409 stays 409 with its error body', async () => {
  const body = '{"success":false,"message":"A published combo must keep at least one image"}';
  stubBackend({ status: 409, body, headers: { 'content-type': 'application/json' } });
  const res = await DELETE(req('DELETE', '/api/v1/admin/combos/c/images/i'), ctx('admin', 'combos', 'c', 'images', 'i'));
  assert.equal(res.status, 409);
  assert.equal(await res.text(), body);
});

test('a backend 500 stays 500 with its error body', async () => {
  const body = '{"success":false,"message":"boom"}';
  stubBackend({ status: 500, body, headers: { 'content-type': 'application/json' } });
  const res = await PATCH(req('PATCH', '/api/v1/x', { body: '{}', headers: { 'content-type': 'application/json' } }), ctx('x'));
  assert.equal(res.status, 500);
  assert.equal(await res.text(), body);
});

test('a response without a Content-Type still defaults to application/json (existing behaviour)', async () => {
  stubBackend({ status: 200, body: '{}' });
  const res = await GET(req('GET', '/api/v1/x'), ctx('x'));
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
});

// ── request side is untouched ─────────────────────────────────────────────────
test('the staff Authorization header and Content-Type are forwarded; the path, query and body are unchanged', async () => {
  const calls = stubBackend({ status: 200, body: '{}' });
  await POST(
    req('POST', '/api/v1/admin/combos/abc/publish?x=1', {
      headers: { authorization: 'Bearer staff-jwt', 'content-type': 'application/json', cookie: 'secret=1', 'x-other': 'no' },
      body: '{"k":"v"}',
    }),
    ctx('admin', 'combos', 'abc', 'publish'),
  );
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/v1/admin/combos/abc/publish');
  assert.equal(url.searchParams.get('x'), '1');
  const sent = calls[0].init.headers as Headers;
  assert.equal(sent.get('authorization'), 'Bearer staff-jwt');
  assert.equal(sent.get('content-type'), 'application/json');
  assert.equal(sent.get('cookie'), null);
  assert.equal(sent.get('x-other'), null);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, '{"k":"v"}');
});

test('no Authorization header is invented when the browser sent none', async () => {
  const calls = stubBackend({ status: 200, body: '{}' });
  await GET(req('GET', '/api/v1/x'), ctx('x'));
  assert.equal((calls[0].init.headers as Headers).get('authorization'), null);
});

// ── the image-delete flow end to end through the proxy ────────────────────────
test('removing an image: backend 204 through the proxy is a client success, with no follow-up GET', async () => {
  const calls = stubBackend({ status: 204, headers: { 'content-type': 'application/json' } });
  // An HttpClient whose transport is the real proxy handler, like axios in the browser.
  const http: HttpClient = {
    get: async () => { throw new Error('no GET expected'); },
    post: async () => { throw new Error('unexpected'); },
    put: async () => { throw new Error('unexpected'); },
    patch: async () => { throw new Error('unexpected'); },
    delete: async (url) => {
      const res = await DELETE(req('DELETE', `/api/v1${url}`, { headers: { authorization: 'Bearer staff-jwt' } }), ctx(...url.split('/').filter(Boolean)));
      if (res.status >= 400) throw Object.assign(new Error('failed'), { response: { status: res.status } });
      return { data: undefined as never, status: res.status };
    },
  };
  await createCombosApi(http).removeImage('c1', 'i1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/admin/combos/c1/images/i1');
});

// ── Phase 1C: bounded upstream, structured failures, no duplicate requests ────
import { STAFF_API_CLIENT_TIMEOUT_MS, STAFF_PROXY_UPSTREAM_TIMEOUT_MS } from '../src/lib/timeouts.ts';
import { describeApiError } from '../src/lib/combos/errors.ts';
import { createServer } from 'node:http';
import axios from 'axios';
const routeModule = await import('../src/app/api/v1/[...path]/route.ts');

function failingBackend(error: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    throw error;
  }) as typeof fetch;
  return calls;
}

test('the upstream request is given a bounded timeout signal', async () => {
  const seen: number[] = [];
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  AbortSignal.timeout = ((ms: number) => {
    seen.push(ms);
    return realTimeout(ms);
  }) as typeof AbortSignal.timeout;
  try {
    const calls = stubBackend({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } });
    await GET(req('GET', '/api/v1/users'), ctx('users'));
    assert.deepEqual(seen, [STAFF_PROXY_UPSTREAM_TIMEOUT_MS]);
    assert.ok((calls[0].init.signal as AbortSignal) instanceof AbortSignal);
  } finally {
    AbortSignal.timeout = realTimeout;
  }
});

test('timeout levels are ordered: upstream < function budget < browser', () => {
  assert.ok(STAFF_PROXY_UPSTREAM_TIMEOUT_MS < routeModule.maxDuration * 1000);
  assert.ok(routeModule.maxDuration * 1000 < STAFF_API_CLIENT_TIMEOUT_MS);
});

test('an upstream timeout becomes a JSON 504 with a stable code', async () => {
  const calls = failingBackend(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  const res = await GET(req('GET', '/api/v1/users?secret=1'), ctx('users'));
  assert.equal(res.status, 504);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'UPSTREAM_TIMEOUT');
  assert.equal(body.message, 'The service took too long to respond');
  assert.equal(body.path, '/api/v1/users', 'the path only, never the query string');
  assert.equal(calls.length, 1, 'no retry');
});

test('a network failure becomes a JSON 502 with a stable code', async () => {
  const calls = failingBackend(new TypeError('fetch failed'));
  const res = await POST(req('POST', '/api/v1/auth/login', { body: '{"a":1}', headers: { 'content-type': 'application/json' } }), ctx('auth', 'login'));
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.deepEqual([body.success, body.code, body.message], [false, 'UPSTREAM_UNAVAILABLE', 'Service unavailable']);
  assert.equal(calls.length, 1, 'a failed POST is never repeated');
});

test('a stalled response body is cut off too, as a 504, without a second request', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    const stalled = new Response('x');
    stalled.arrayBuffer = () => Promise.reject(new DOMException('timeout', 'TimeoutError'));
    return stalled;
  }) as typeof fetch;
  const res = await PATCH(req('PATCH', '/api/v1/users/1', { body: '{}' }), ctx('users', '1'));
  assert.equal(res.status, 504);
  assert.equal(calls, 1);
});

for (const status of [400, 401, 403, 404, 409, 429, 500, 503]) {
  test(`an upstream ${status} is passed through unchanged (never turned into 502/504)`, async () => {
    stubBackend({ status, body: JSON.stringify({ message: `upstream ${status}`, code: 'X' }), headers: { 'content-type': 'application/json' } });
    const res = await GET(req('GET', '/api/v1/users', { headers: { authorization: 'Bearer t' } }), ctx('users'));
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { message: `upstream ${status}`, code: 'X' });
  });
}

test('successful requests keep method, authorization, body and content type, in one upstream call', async () => {
  const calls = stubBackend({ status: 201, body: '{"id":"1"}', headers: { 'content-type': 'application/json' } });
  const res = await POST(
    req('POST', '/api/v1/admin/combos?x=1', { body: '{"name":"A"}', headers: { authorization: 'Bearer tok', 'content-type': 'application/json' } }),
    ctx('admin', 'combos'),
  );
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { id: '1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer tok');
  assert.equal(calls[0].init.body, '{"name":"A"}');
  assert.match(calls[0].url, /\/api\/v1\/admin\/combos\?x=1$/);
});

test('the staff axios client waits longer than the proxy and hands back the proxy 504 as a normal API failure', async () => {
  const { default: api } = await import('../src/lib/api.ts');
  assert.equal(api.defaults.timeout, STAFF_API_CLIENT_TIMEOUT_MS);
  assert.ok((api.defaults.timeout ?? 0) > STAFF_PROXY_UPSTREAM_TIMEOUT_MS);

  const calls = failingBackend(new DOMException('timeout', 'TimeoutError'));
  // A real HTTP server in front of the REAL route handler, and a real axios call to it.
  const server = createServer(async (incoming, outgoing) => {
    const res = await GET(new NextRequest(`http://admin.test${incoming.url}`), ctx('users'));
    outgoing.writeHead(res.status, { 'content-type': res.headers.get('content-type') ?? 'application/json' });
    outgoing.end(await res.text());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as { port: number };
    const client = axios.create({ baseURL: `http://127.0.0.1:${port}`, timeout: api.defaults.timeout, adapter: 'http' });
    const error = await client.get('/api/v1/users').then(
      () => null,
      (e) => e,
    );
    assert.equal(error.code === 'ECONNABORTED', false, 'the browser did not give up first');
    assert.equal(error.response.status, 504);
    assert.equal(error.response.data.code, 'UPSTREAM_TIMEOUT');
    const problem = describeApiError(error);
    assert.equal(problem.status, 504);
    assert.equal(problem.message, 'The service took too long to respond');
    assert.equal(calls.length, 1, 'one upstream attempt for one browser request');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
