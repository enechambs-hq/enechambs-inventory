import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { register } from 'node:module';
import { isValidRequestId, resolveRequestId, responseRequestId } from '../src/lib/request-id.ts';
import { handleStoreRequest } from '../src/lib/server/store-bff.ts';
import { handleStoreSessionRequest } from '../src/lib/server/store-auth.ts';
import { storeRequest } from '../src/lib/storefront/store-client.ts';
import { appErrorFromStaff } from '../src/lib/errors/staff-adapter.ts';
import { appErrorFromStore } from '../src/lib/errors/store-adapter.ts';

register('data:text/javascript,' + encodeURIComponent("export async function resolve(s,c,n){return n(s==='next/server'?'next/server.js':s,c)}"), import.meta.url);
const { NextRequest } = await import('next/server.js');
const { GET, POST } = await import('../src/app/api/v1/[...path]/route.ts');

const ID = '3f2b8c1e-9d4a-4e7b-8a6f-1c2d3e4f5a6b';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const BAD = ['', 'req-1', `${ID}?token=abc`, 'ada.obi@example.com', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMifQ.c2lnbmF0dXJl', `${ID}${ID}`];

// ── the helper ────────────────────────────────────────────────────────────────
test('only a UUID is accepted as a request id; anything else is replaced, never echoed', () => {
  assert.equal(isValidRequestId(ID), true);
  for (const bad of BAD) assert.equal(isValidRequestId(bad), false, bad);
  assert.equal(resolveRequestId(ID.toUpperCase()), ID);
  for (const bad of [...BAD, null, undefined]) {
    const id = resolveRequestId(bad as string | null);
    assert.equal(isValidRequestId(id), true);
    assert.notEqual(id, bad);
  }
  assert.notEqual(resolveRequestId(undefined), resolveRequestId(undefined));
});

test("the API's id wins when it is valid, otherwise ours is used", () => {
  assert.equal(responseRequestId(new Headers({ 'x-request-id': OTHER }), ID), OTHER);
  assert.equal(responseRequestId(new Headers({ 'x-request-id': 'nope' }), ID), ID);
  assert.equal(responseRequestId(new Headers(), ID), ID);
  assert.equal(responseRequestId(undefined, ID), ID);
});

// ── the staff proxy ───────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const nreq = (method: string, url: string, headers: Record<string, string> = {}) => new NextRequest(`http://admin.test${url}`, { method, headers });
function stub(answer: { status: number; body?: string; headers?: Record<string, string> } | Error) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  globalThis.fetch = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init.headers) });
    if (answer instanceof Error) throw answer;
    return new Response(answer.body == null ? null : new TextEncoder().encode(answer.body), { status: answer.status, headers: answer.headers });
  }) as typeof fetch;
  return calls;
}

test('proxy: a valid incoming id goes to the API and comes back on the response', async () => {
  const calls = stub({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } });
  const res = await GET(nreq('GET', '/api/v1/x', { 'x-request-id': ID }), ctx('x'));
  assert.equal(calls[0].headers.get('x-request-id'), ID);
  assert.equal(res.headers.get('x-request-id'), ID);
});

test('proxy: a missing or invalid id is replaced by a generated one that is sent upstream and returned', async () => {
  for (const bad of [undefined, ...BAD.filter(Boolean)]) {
    const calls = stub({ status: 200, body: '{}', headers: { 'content-type': 'application/json' } });
    const res = await GET(nreq('GET', '/api/v1/x?token=secret', bad ? { 'x-request-id': bad } : {}), ctx('x'));
    const sent = calls[0].headers.get('x-request-id');
    assert.equal(isValidRequestId(sent), true);
    assert.notEqual(sent, bad);
    assert.equal(res.headers.get('x-request-id'), sent);
  }
});

test("proxy: the API's own id is preserved when it reports one (an error id survives the proxy intact)", async () => {
  stub({ status: 500, body: JSON.stringify({ success: false, status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: OTHER }), headers: { 'content-type': 'application/json', 'x-request-id': OTHER } });
  const res = await POST(nreq('POST', '/api/v1/x', { 'x-request-id': ID }), ctx('x'));
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('x-request-id'), OTHER);
  assert.equal((await res.json()).requestId, OTHER);
});

test('proxy: its own 502 and 504 answers carry the id in the header and the body, and no query string', async () => {
  stub(new TypeError('fetch failed'));
  const unavailable = await GET(nreq('GET', '/api/v1/x?token=secret', { 'x-request-id': ID }), ctx('x'));
  assert.equal(unavailable.status, 502);
  const body = await unavailable.json();
  assert.equal(body.requestId, ID);
  assert.equal(unavailable.headers.get('x-request-id'), ID);
  assert.equal(body.code, 'UPSTREAM_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(body), /secret/);
  const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
  stub(timeout);
  const slow = await GET(nreq('GET', '/api/v1/x'), ctx('x'));
  assert.equal(slow.status, 504);
  assert.equal(isValidRequestId((await slow.json()).requestId), true);
});

test('proxy: a 204 carries the id header too', async () => {
  stub({ status: 204 });
  const res = await POST(nreq('POST', '/api/v1/x', { 'x-request-id': ID }), ctx('x'));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('x-request-id'), ID);
});

// ── the customer BFF ──────────────────────────────────────────────────────────
const ENV = { STOREFRONT_ENABLED: 'true', BFF_SHARED_SECRET: 'test-secret-0123456789abcdef0123456789', BACKEND_URL: 'http://backend.test', VERCEL: '1' };
const BASE = 'https://shop.example.test';
function backend(answer: { status: number; body?: string; headers?: Record<string, string> }) {
  const calls: Array<{ headers: Headers }> = [];
  const f = (async (_u: URL | string, init: RequestInit) => {
    calls.push({ headers: new Headers(init.headers) });
    return new Response(answer.body ?? '{}', { status: answer.status, headers: { 'content-type': 'application/json', ...(answer.headers ?? {}) } });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const get = (headers: Record<string, string> = {}) => new Request(`${BASE}/api/store/storefront/orders`, { method: 'GET', headers: { host: 'shop.example.test', ...headers } });

test('BFF: the id is forwarded to the API and returned to the browser; a bad id is replaced', async () => {
  const b = backend({ status: 200 });
  const ok = await handleStoreRequest(get({ 'x-request-id': ID }), ['storefront', 'orders'], { env: ENV, fetch: b.f });
  assert.equal(b.calls[0].headers.get('x-request-id'), ID);
  assert.equal(ok.headers.get('x-request-id'), ID);
  const b2 = backend({ status: 200 });
  const bad = await handleStoreRequest(get({ 'x-request-id': `${ID}?token=abc` }), ['storefront', 'orders'], { env: ENV, fetch: b2.f });
  const sent = b2.calls[0].headers.get('x-request-id');
  assert.equal(isValidRequestId(sent), true);
  assert.equal(bad.headers.get('x-request-id'), sent);
  assert.doesNotMatch(String(sent), /token/);
});

test("BFF: an API error keeps the API's id in the header and the body", async () => {
  const b = backend({ status: 409, body: JSON.stringify({ success: false, status: 409, code: 'INSUFFICIENT_STOCK', message: 'No stock', requestId: OTHER }), headers: { 'x-request-id': OTHER } });
  const res = await handleStoreRequest(get({ 'x-request-id': ID }), ['storefront', 'orders'], { env: ENV, fetch: b.f });
  assert.equal(res.status, 409);
  assert.equal(res.headers.get('x-request-id'), OTHER);
  assert.equal((await res.json()).requestId, OTHER);
});

test("BFF: the layer's own refusals and 502/504 include the id (header and body)", async () => {
  const off = await handleStoreRequest(get({ 'x-request-id': ID }), ['storefront', 'orders'], { env: { ...ENV, STOREFRONT_ENABLED: 'false' }, fetch: backend({ status: 200 }).f });
  assert.equal(off.status, 404);
  assert.equal(off.headers.get('x-request-id'), ID);
  assert.equal((await off.json()).requestId, ID);
  const down = await handleStoreRequest(get({ 'x-request-id': ID }), ['storefront', 'orders'], { env: ENV, fetch: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch });
  assert.equal(down.status, 502);
  assert.equal(down.headers.get('x-request-id'), ID);
  assert.equal((await down.json()).requestId, ID);
});

test('BFF session handler: a failed login keeps the id on the response header and in the body, with no cookie', async () => {
  const b = backend({ status: 401, body: JSON.stringify({ success: false, status: 401, code: 'UNAUTHENTICATED', message: 'Invalid credentials', requestId: OTHER }), headers: { 'x-request-id': OTHER } });
  const req = new Request(`${BASE}/api/store/auth/login`, { method: 'POST', headers: { host: 'shop.example.test', origin: BASE, 'content-type': 'application/json' }, body: '{"email":"a@b.com","password":"x"}' });
  const res = await handleStoreSessionRequest(req, 'login', { env: ENV, fetch: b.f });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('x-request-id'), OTHER);
  assert.equal((await res.json()).requestId, OTHER);
  assert.equal(res.headers.get('set-cookie'), null);
});

// ── the browser side: StoreFailure and AppError ───────────────────────────────
test('a failed customer call carries the request id into the shared AppError (correlationId)', async () => {
  const fetcher = async () => new Response(JSON.stringify({ success: false, status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: OTHER }), { status: 500, headers: { 'content-type': 'application/json', 'x-request-id': OTHER } });
  const r = await storeRequest({ path: 'storefront/orders', parse: () => ({}), fetcher });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.requestId, OTHER);
  const e = appErrorFromStore(r, { method: 'GET' });
  assert.equal(e.correlationId, OTHER);
  assert.equal(e.kind, 'unexpected');
  assert.equal(e.message, 'Something went wrong. Please try again.'); // server text never shown for a 5xx
});

test('a malformed id in a response is dropped, not shown', async () => {
  const fetcher = async () => new Response(JSON.stringify({ message: 'x', requestId: '<script>' }), { status: 500, headers: { 'content-type': 'application/json', 'x-request-id': 'a b' } });
  const r = await storeRequest({ path: 'storefront/orders', parse: () => ({}), fetcher });
  if (r.ok) return assert.fail();
  assert.equal(r.requestId, undefined);
});

test('a staff API error exposes its id as correlationId from the header or the body (axios shape)', () => {
  const viaHeader = { response: { status: 500, data: { message: 'Internal server error' }, headers: { 'x-request-id': OTHER } }, config: { method: 'get' } };
  assert.equal(appErrorFromStaff(viaHeader).correlationId, OTHER);
  const viaBody = { response: { status: 502, data: { success: false, code: 'UPSTREAM_UNAVAILABLE', message: 'Service unavailable', requestId: ID }, headers: {} }, config: { method: 'get' } };
  const e = appErrorFromStaff(viaBody);
  assert.equal(e.correlationId, ID);
  assert.equal(e.kind, 'unavailable');
});

// ── compatibility with the new error contract ─────────────────────────────────
test('the new contract (default codes, details, status, path) leaves AppError kinds, messages and retry rules unchanged', () => {
  const axiosErr = (status: number, data: Record<string, unknown>, method = 'get') => ({
    response: { status, data: { success: false, status, timestamp: '2026-11-09T10:00:00Z', path: '/api/v1/x', requestId: ID, ...data }, headers: { 'x-request-id': ID } }, config: { method },
  });
  const cases: Array<[number, string, string, boolean]> = [
    [401, 'UNAUTHENTICATED', 'unauthenticated', false],
    [403, 'FORBIDDEN', 'forbidden', false],
    [404, 'NOT_FOUND', 'not_found', false],
    [409, 'CONFLICT', 'conflict', false],
    [429, 'RATE_LIMITED', 'rate_limited', false],
    [503, 'SERVICE_UNAVAILABLE', 'unavailable', true],
    [500, 'INTERNAL_ERROR', 'unexpected', true],
  ];
  for (const [status, code, kind, retryable] of cases) {
    const e = appErrorFromStaff(axiosErr(status, { code, message: 'Some server text' }));
    assert.equal(e.kind, kind, `${status}`);
    assert.equal(e.retryable, retryable, `${status} retry`);
    assert.equal(e.code, code);
    assert.equal(e.correlationId, ID);
  }
  // writes are never retryable, whatever the code
  assert.equal(appErrorFromStaff(axiosErr(500, { code: 'INTERNAL_ERROR', message: 'x' }, 'post')).retryable, false);
});

test('validation: the message list still drives the AppError; the new details field is harmless', () => {
  const e = appErrorFromStaff({
    response: { status: 400, headers: { 'x-request-id': ID }, data: {
      success: false, status: 400, code: 'VALIDATION_FAILED', requestId: ID,
      message: ['name should not be empty', 'price must be a positive number'],
      details: [{ field: 'name', messages: ['name should not be empty'] }, { field: 'price', messages: ['price must be a positive number'] }],
    } },
    config: { method: 'post' },
  });
  assert.equal(e.kind, 'validation');
  assert.equal(e.code, 'VALIDATION_FAILED');
  assert.deepEqual(e.details, ['name should not be empty', 'price must be a positive number']);
  assert.equal(e.correlationId, ID);
  assert.equal(e.retryable, false);
});
