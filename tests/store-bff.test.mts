import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CLIENT_IP_SIGNATURE_HEADER,
  MAX_BODY_BYTES,
  readBodyWithLimit,
  readCookie,
} from '../src/lib/server/bff.ts';
import { handleStoreRequest } from '../src/lib/server/store-bff.ts';

const HOST = 'shop.example.test';
const BASE = `https://${HOST}`;
const SECRET = 'test-secret-0123456789abcdef0123456789';
const JWT = 'eyJhbGciOi.eyJzdWIiOiIx.c2ln_-Z';

const ENV = {
  STOREFRONT_ENABLED: 'true',
  BFF_SHARED_SECRET: SECRET,
  BACKEND_URL: 'http://backend.test',
  VERCEL: '1',
};

/** A fetch double that records every call made to the "backend". */
function fakeBackend() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const call = (req: Request, env: Record<string, string | undefined> = ENV) => {
  const backend = fakeBackend();
  const run = handleStoreRequest(req, ['storefront', 'orders'], { env, fetch: backend.f });
  return { backend, run };
};

const headersWith = (extra: Record<string, string> = {}) => ({
  origin: BASE,
  host: HOST,
  'content-type': 'application/json',
  ...extra,
});

const postBytes = (body: BodyInit, extra: Record<string, string> = {}) =>
  new Request(`${BASE}/api/store/storefront/orders`, {
    method: 'POST',
    headers: headersWith(extra),
    body,
  });

/** A request whose body is a stream with NO Content-Length header. */
function postStream(
  chunkBytes: number,
  chunkCount: number,
  stats: { pulled: number; cancelled: boolean },
  extra: Record<string, string> = {},
) {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunkCount) return controller.close();
      i++;
      stats.pulled++;
      controller.enqueue(new Uint8Array(chunkBytes).fill(0x61));
    },
    cancel() {
      stats.cancelled = true;
    },
  });
  return new Request(`${BASE}/api/store/storefront/orders`, {
    method: 'POST',
    headers: headersWith(extra),
    body: stream,
    // Node requires this for a streamed request body.
    duplex: 'half',
  } as RequestInit);
}

// ── the required cases ──────────────────────────────────────────────────────

test('a valid JSON body within the limit is forwarded unchanged', async () => {
  const payload = '{"items":[{"comboId":"abc","quantity":2}],"note":"café"}';
  const { backend, run } = call(postBytes(payload));
  const res = await run;
  assert.equal(res.status, 200);
  assert.equal(backend.calls.length, 1);
  assert.equal(
    new TextDecoder().decode(backend.calls[0].init.body as Uint8Array),
    payload,
  );
  assert.equal(backend.calls[0].url, 'http://backend.test/api/v1/storefront/orders');
});

test('a body of exactly MAX_BODY_BYTES is accepted, one more byte is not', async () => {
  const exact = new Uint8Array(MAX_BODY_BYTES).fill(0x20);
  const ok = call(postBytes(exact));
  assert.equal((await ok.run).status, 200);
  assert.equal(ok.backend.calls.length, 1);

  const stats = { pulled: 0, cancelled: false };
  const over = call(postStream(MAX_BODY_BYTES + 1, 1, stats));
  assert.equal((await over.run).status, 413);
  assert.equal(over.backend.calls.length, 0);
});

test('a declared Content-Length over the limit is refused with 413 and never forwarded', async () => {
  // Small real body, large declared length: refused on the declaration alone.
  const { backend, run } = call(
    postBytes('{}', { 'content-length': String(MAX_BODY_BYTES + 1) }),
  );
  const res = await run;
  assert.equal(res.status, 413);
  assert.equal(backend.calls.length, 0);
});

test('a streamed body over the limit with NO Content-Length is refused with 413 and reading stops early', async () => {
  const stats = { pulled: 0, cancelled: false };
  const req = postStream(1024, 1000, stats); // would be ~1 MB if fully read
  assert.equal(req.headers.get('content-length'), null);

  const { backend, run } = call(req);
  const res = await run;
  assert.equal(res.status, 413);
  assert.equal(backend.calls.length, 0, 'the oversized request must never reach the backend');
  assert.equal(stats.cancelled, true, 'the stream must be cancelled');
  // 64 chunks of 1 KiB fit; the 65th crosses the limit. A little read-ahead is
  // fine, but the sender must not be drained to the end (1000 chunks).
  assert.ok(stats.pulled <= 70, `read ${stats.pulled} chunks; should stop near 65`);
});

test('a lying Content-Length cannot smuggle an oversized body past the limit', async () => {
  const stats = { pulled: 0, cancelled: false };
  const { backend, run } = call(postStream(4096, 100, stats, { 'content-length': '10' }));
  assert.equal((await run).status, 413);
  assert.equal(backend.calls.length, 0);
  assert.equal(stats.cancelled, true);
});

test('a non-numeric Content-Length is ignored and the stream is still enforced', async () => {
  const stats = { pulled: 0, cancelled: false };
  const { backend, run } = call(postStream(4096, 100, stats, { 'content-length': 'abc' }));
  assert.equal((await run).status, 413);
  assert.equal(backend.calls.length, 0);
});

test('bytes are counted, not characters: multi-byte text over the byte limit is refused', async () => {
  // 40,000 characters but 80,000 UTF-8 bytes.
  const text = 'é'.repeat(40_000);
  assert.equal(text.length, 40_000);
  assert.ok(new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES);
  const { backend, run } = call(postBytes(text));
  assert.equal((await run).status, 413);
  assert.equal(backend.calls.length, 0);

  // 30,000 characters = 60,000 bytes: under the limit, accepted.
  const fine = call(postBytes('é'.repeat(30_000)));
  assert.equal((await fine.run).status, 200);
});

test('many small chunks that add up past the limit are refused', async () => {
  const stats = { pulled: 0, cancelled: false };
  const { backend, run } = call(postStream(100, 2000, stats));
  assert.equal((await run).status, 413);
  assert.equal(backend.calls.length, 0);
  assert.ok(stats.pulled < 700);
});

// ── readBodyWithLimit on its own ────────────────────────────────────────────

test('readBodyWithLimit: no body is an empty success', async () => {
  const r = await readBodyWithLimit(null, 10);
  assert.deepEqual(r.ok && r.bytes.byteLength, 0);
});

test('readBodyWithLimit: reports too_large and cancels the source', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      c.enqueue(new Uint8Array(6));
    },
    cancel() {
      cancelled = true;
    },
  });
  const r = await readBodyWithLimit(stream, 10);
  assert.deepEqual(r, { ok: false, reason: 'too_large' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, true);
});

test('readBodyWithLimit: a stream that errors is reported as unreadable', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.error(new Error('client went away'));
    },
  });
  assert.deepEqual(await readBodyWithLimit(stream, 10), { ok: false, reason: 'unreadable' });
});

// ── existing protections are retained (the handler was restructured) ────────

test('GET with no body never reads or forwards one', async () => {
  const backend = fakeBackend();
  const res = await handleStoreRequest(
    new Request(`${BASE}/api/store/storefront/combos?page=2`, { headers: { host: HOST } }),
    ['storefront', 'combos'],
    { env: ENV, fetch: backend.f },
  );
  assert.equal(res.status, 200);
  assert.equal(backend.calls[0].init.body, undefined);
  assert.equal(backend.calls[0].url, 'http://backend.test/api/v1/storefront/combos?page=2');
});

test('Origin is still enforced, and is checked before any body is read', async () => {
  const stats = { pulled: 0, cancelled: false };
  const noOrigin = postStream(1024, 10, stats, { origin: '' });
  // An empty Origin header counts as missing.
  const a = call(noOrigin);
  assert.equal((await a.run).status, 403);
  assert.equal(a.backend.calls.length, 0);
  // (A ReadableStream prefetches its first chunk when constructed, so counting
  // pulls would be misleading; the question is whether the body was consumed.)
  assert.equal(noOrigin.bodyUsed, false, 'a refused origin must not cause the body to be read');

  const evil = call(postBytes('{}', { origin: 'https://evil.example.test' }));
  assert.equal((await evil.run).status, 403);
  assert.equal(evil.backend.calls.length, 0);
});

test('JSON content-type is still required', async () => {
  const { backend, run } = call(postBytes('x', { 'content-type': 'text/plain' }));
  assert.equal((await run).status, 415);
  assert.equal(backend.calls.length, 0);
});

test('Idempotency-Key is still validated, and a valid one is forwarded', async () => {
  const bad = call(postBytes('{}', { 'idempotency-key': 'bad key!' }));
  assert.equal((await bad.run).status, 400);
  assert.equal(bad.backend.calls.length, 0);

  const key = '3f1c2a9e-5b7d-4c1e-9a2b-0d4e6f8a1b2c';
  const good = call(postBytes('{}', { 'idempotency-key': key }));
  assert.equal((await good.run).status, 200);
  assert.equal(
    new Headers(good.backend.calls[0].init.headers).get('idempotency-key'),
    key,
  );
});

test('authorization comes from the cookie; a browser Authorization header is dropped', async () => {
  const { backend, run } = call(
    postBytes('{}', {
      cookie: `other=1; ene_cust=${JWT}`,
      authorization: 'Bearer BROWSER-SUPPLIED',
      'x-custom-evil': 'yes',
    }),
  );
  await run;
  const sent = new Headers(backend.calls[0].init.headers);
  assert.equal(sent.get('authorization'), `Bearer ${JWT}`);
  assert.equal(sent.get('x-custom-evil'), null);
  assert.equal(JSON.stringify([...sent.entries()]).includes('BROWSER-SUPPLIED'), false);
});

test('a malformed cookie token is not forwarded', async () => {
  const { backend, run } = call(postBytes('{}', { cookie: 'ene_cust=not-a-jwt' }));
  await run;
  assert.equal(new Headers(backend.calls[0].init.headers).get('authorization'), null);
});

test('signed client IP is attached on Vercel from the platform header, and ignores browser x-bff-*', async () => {
  const { backend, run } = call(
    postBytes('{}', {
      'x-vercel-forwarded-for': '203.0.113.9',
      'x-bff-client-ip': '6.6.6.6',
      'x-bff-signature': 'f'.repeat(64),
    }),
  );
  await run;
  const sent = new Headers(backend.calls[0].init.headers);
  assert.equal(sent.get('x-bff-client-ip'), '203.0.113.9');
  assert.notEqual(sent.get(CLIENT_IP_SIGNATURE_HEADER), 'f'.repeat(64));
  assert.match(sent.get(CLIENT_IP_SIGNATURE_HEADER) ?? '', /^[0-9a-f]{64}$/);
});

test('off Vercel, no signed IP is sent and browser x-bff-* never reaches the backend', async () => {
  const { backend, run } = call(
    postBytes('{}', { 'x-vercel-forwarded-for': '203.0.113.9', 'x-bff-client-ip': '6.6.6.6' }),
    { ...ENV, VERCEL: undefined },
  );
  await run;
  const sent = new Headers(backend.calls[0].init.headers);
  assert.equal(sent.get('x-bff-client-ip'), null);
  assert.equal(sent.get(CLIENT_IP_SIGNATURE_HEADER), null);
});

test('flag off, missing secret, and non-storefront paths are refused without calling the backend', async () => {
  const off = call(postBytes('{}'), { ...ENV, STOREFRONT_ENABLED: 'false' });
  assert.equal((await off.run).status, 404);
  assert.equal(off.backend.calls.length, 0);

  const noSecret = call(postBytes('{}'), { ...ENV, BFF_SHARED_SECRET: undefined });
  assert.equal((await noSecret.run).status, 503);
  assert.equal(noSecret.backend.calls.length, 0);

  const backend = fakeBackend();
  const res = await handleStoreRequest(postBytes('{}'), ['users', 'me'], { env: ENV, fetch: backend.f });
  assert.equal(res.status, 404);
  assert.equal(backend.calls.length, 0);
});

test('backend failures become 502 / 504 without leaking details; upstream Set-Cookie is dropped', async () => {
  const boom = (async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
  }) as unknown as typeof fetch;
  const r = await handleStoreRequest(postBytes('{}'), ['storefront', 'orders'], { env: ENV, fetch: boom });
  assert.equal(r.status, 502);
  assert.equal(JSON.stringify(await r.json()).includes('ECONNREFUSED'), false);

  const withCookie = (async () =>
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'evil=1', 'retry-after': '7' },
    })) as unknown as typeof fetch;
  const ok = await handleStoreRequest(postBytes('{}'), ['storefront', 'orders'], { env: ENV, fetch: withCookie });
  assert.equal(ok.headers.get('set-cookie'), null);
  assert.equal(ok.headers.get('retry-after'), '7');
  assert.equal(ok.headers.get('cache-control'), 'no-store');
});

test('readCookie finds the named cookie and tolerates junk', () => {
  assert.equal(readCookie('a=1; ene_cust=xyz; b=2', 'ene_cust'), 'xyz');
  assert.equal(readCookie('ene_cust=a=b', 'ene_cust'), 'a=b');
  assert.equal(readCookie(null, 'ene_cust'), undefined);
  assert.equal(readCookie('novalue; other', 'ene_cust'), undefined);
  assert.equal(readCookie('xene_cust=1', 'ene_cust'), undefined);
});
