import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleStoreRequest } from '../src/lib/server/store-bff.ts';
import { fetchComboBySlug, fetchComboList, type StoreHandle } from '../src/lib/storefront/catalogue-client.ts';

const ENV_ON = {
  STOREFRONT_ENABLED: 'true',
  BFF_SHARED_SECRET: 'test-secret-0123456789abcdef0123456789',
  BACKEND_URL: 'http://backend.test',
  VERCEL: '1',
};

const comboWire = (over: Record<string, unknown> = {}) => ({
  name: 'Festive Rice Combo', slug: 'festive-rice-combo', description: 'Rice', price: 25000, referencePrice: null,
  images: [], availability: { status: 'available', label: 'Available' }, ...over,
});

/** The REAL BFF handler in front of a fake backend. */
function setup(answer: (url: URL) => Response | Promise<Response>, env: Record<string, string | undefined> = ENV_ON, incoming: HeadersInit = {}) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fakeFetch = (async (url: URL | string, init: RequestInit) => {
    calls.push({ url: new URL(String(url)), init });
    return answer(new URL(String(url)));
  }) as unknown as typeof fetch;
  const handle: StoreHandle = (segments, query) =>
    handleStoreRequest(
      new Request(`http://storefront.internal/api/store/${segments.join('/')}${query}`, { headers: incoming }),
      segments,
      { env, fetch: fakeFetch },
    );
  return { handle, calls };
}
const jsonRes = (body: unknown, status = 200) => Response.json(body, { status });

// ── endpoints used ────────────────────────────────────────────────────────────
test('the list goes to GET storefront/combos with page, limit and q only', async () => {
  const { handle, calls } = setup(() =>
    jsonRes({ data: [comboWire()], meta: { total: 1, page: 2, limit: 12, totalPages: 3 } }),
  );
  const result = await fetchComboList(handle, { page: 2, limit: 12, q: 'rice' });
  assert.ok(result.ok);
  assert.equal(result.data.data[0].name, 'Festive Rice Combo');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'http://backend.test');
  assert.equal(calls[0].url.pathname, '/api/v1/storefront/combos');
  assert.deepEqual([...calls[0].url.searchParams.keys()].sort(), ['limit', 'page', 'q']);
  assert.equal(calls[0].url.searchParams.get('q'), 'rice');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.cache, 'no-store');
});

test('the detail goes to GET storefront/combos/<slug>', async () => {
  const { handle, calls } = setup(() => jsonRes(comboWire()));
  const result = await fetchComboBySlug(handle, 'festive-rice-combo');
  assert.ok(result.ok);
  assert.equal(calls[0].url.pathname, '/api/v1/storefront/combos/festive-rice-combo');
  assert.equal(calls[0].url.search, '');
});

test('an impossible slug never reaches the BFF or the API', async () => {
  const { handle, calls } = setup(() => jsonRes(comboWire()));
  for (const slug of ['../users', 'Bad Slug', '', 'a/b', "x'--", 'x'.repeat(200)]) {
    const result = await fetchComboBySlug(handle, slug);
    assert.deepEqual(result, { ok: false, kind: 'not_found', status: 404 });
  }
  assert.equal(calls.length, 0);
});

// ── no staff credential, no browser authority ─────────────────────────────────
test('no Authorization header (and no staff cookie) is ever sent upstream, even if the visitor had them', async () => {
  const { handle, calls } = setup(
    () => jsonRes({ data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } }),
    ENV_ON,
    { authorization: 'Bearer staff-jwt', cookie: 'token=staff-jwt', 'x-bff-client-ip': '6.6.6.6' },
  );
  await fetchComboList(handle, {});
  const sent = new Headers(calls[0].init.headers);
  assert.equal(sent.get('authorization'), null);
  assert.equal(sent.get('cookie'), null);
  assert.equal(sent.get('x-bff-client-ip'), null); // not the forged one (no trusted IP here)
});

test('on Vercel the visitor address is signed for rate limiting (and a forged BFF header is not forwarded)', async () => {
  const { handle, calls } = setup(
    () => jsonRes({ data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } }),
    ENV_ON,
    { 'x-forwarded-for': '203.0.113.7', 'x-bff-signature': 'forged' },
  );
  await fetchComboList(handle, {});
  const sent = new Headers(calls[0].init.headers);
  assert.equal(sent.get('x-bff-client-ip'), '203.0.113.7');
  assert.notEqual(sent.get('x-bff-signature'), 'forged');
  assert.ok(sent.get('x-bff-signature'));
});

// ── flag and failures ─────────────────────────────────────────────────────────
test('flag off: the BFF answers 404 and the API is never called', async () => {
  const { handle, calls } = setup(() => jsonRes(comboWire()), { ...ENV_ON, STOREFRONT_ENABLED: 'false' });
  assert.deepEqual(await fetchComboList(handle, {}), { ok: false, kind: 'not_found', status: 404 });
  assert.deepEqual(await fetchComboBySlug(handle, 'festive-rice-combo'), { ok: false, kind: 'not_found', status: 404 });
  assert.equal(calls.length, 0);
});

test('missing BFF secret is reported as unavailable (503), not a crash', async () => {
  const { handle } = setup(() => jsonRes({}), { ...ENV_ON, BFF_SHARED_SECRET: undefined });
  const result = await fetchComboList(handle, {});
  assert.deepEqual(result, { ok: false, kind: 'unavailable', status: 503 });
});

test('API failures map to states the UI can show', async () => {
  const cases: Array<[number, string]> = [[404, 'not_found'], [429, 'rate_limited'], [500, 'error'], [502, 'unavailable'], [503, 'unavailable'], [400, 'error']];
  for (const [status, kind] of cases) {
    const { handle } = setup(() => jsonRes({ message: 'x' }, status));
    const result = await fetchComboList(handle, {});
    assert.equal(result.ok, false);
    assert.equal((result as { kind: string }).kind, kind, String(status));
  }
});

test('a backend that is down, slow or returns junk is an error state, not an exception', async () => {
  const down = setup(() => { throw new TypeError('fetch failed'); });
  assert.equal((await fetchComboList(down.handle, {})).ok, false);
  const junk = setup(() => new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  assert.deepEqual(await fetchComboList(junk.handle, {}), { ok: false, kind: 'error', status: 200 });
  const wrongShape = setup(() => jsonRes({ items: [] }));
  assert.equal((await fetchComboList(wrongShape.handle, {})).ok, false);
  const thrown = (async () => { throw new Error('boom'); }) as StoreHandle;
  assert.deepEqual(await fetchComboList(thrown, {}), { ok: false, kind: 'unavailable', status: 0 });
  assert.deepEqual(await fetchComboBySlug(thrown, 'a-b'), { ok: false, kind: 'unavailable', status: 0 });
});

test('detail: an unknown slug is a 404 state; a malformed body is an error state', async () => {
  const missing = setup(() => jsonRes({ message: 'Combo not found' }, 404));
  assert.deepEqual(await fetchComboBySlug(missing.handle, 'no-such-combo'), { ok: false, kind: 'not_found', status: 404 });
  const bad = setup(() => jsonRes({ name: 'x' }));
  assert.equal((await fetchComboBySlug(bad.handle, 'no-such-combo')).ok, false);
});

test('empty catalogue and sold-out items come through intact', async () => {
  const empty = setup(() => jsonRes({ data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } }));
  const r1 = await fetchComboList(empty.handle, {});
  assert.ok(r1.ok && r1.data.data.length === 0 && r1.data.meta.total === 0);
  const soldOut = setup(() =>
    jsonRes({ data: [comboWire({ availability: { status: 'sold_out', label: 'Sold Out' } })], meta: { total: 1, page: 1, limit: 12, totalPages: 1 } }),
  );
  const r2 = await fetchComboList(soldOut.handle, {});
  assert.ok(r2.ok && r2.data.data[0].availability.status === 'sold_out');
});

test('responses are not cacheable: the BFF marks them no-store', async () => {
  const { handle } = setup(() => jsonRes({ data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } }));
  const raw = await handle(['storefront', 'combos'], '?page=1&limit=12');
  assert.equal(raw.headers.get('cache-control'), 'no-store');
});

test('staff and payment paths are unreachable through the same handler (allowlist intact)', async () => {
  const { handle, calls } = setup(() => jsonRes({}));
  for (const segments of [['admin', 'combos'], ['auth', 'login'], ['inventory'], ['storefront', '..', 'users']]) {
    const res = await handle(segments, '');
    assert.equal(res.status, 404, segments.join('/'));
  }
  assert.equal(calls.length, 0);
});
