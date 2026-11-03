import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildListParams, createCombosApi } from '../src/lib/combos/combos-api.ts';
import { describeApiError, explainProblem } from '../src/lib/combos/errors.ts';
import { combo, fakeHttp, httpError, image, networkError } from './combos-support.mts';

const ID = '11111111-1111-4111-8111-111111111111';

// ── list / search / filter / pagination parameters ────────────────────────────
test('list sends defaults and omits empty filters', () => {
  assert.deepEqual(buildListParams(), { page: 1, limit: 20 });
  assert.deepEqual(buildListParams({ status: '', q: '   ' }), { page: 1, limit: 20 });
});

test('list sends status, trimmed search text, page and limit', () => {
  assert.deepEqual(buildListParams({ page: 3, limit: 50, status: 'published', q: '  rice  ' }), {
    page: 3,
    limit: 50,
    status: 'published',
    q: 'rice',
  });
});

test('list clamps what the backend would reject (page < 1, limit > 100, long search)', () => {
  const p = buildListParams({ page: 0, limit: 500, q: 'x'.repeat(300) });
  assert.equal(p.page, 1);
  assert.equal(p.limit, 100);
  assert.equal(String(p.q).length, 100);
  assert.deepEqual(buildListParams({ page: 2.5, limit: -4 }), { page: 1, limit: 20 });
});

test('list calls GET /admin/combos with those params and returns the paginated body unchanged', async () => {
  const body = { data: [combo()], meta: { total: 1, page: 2, limit: 20, totalPages: 3 } };
  const { http, calls } = fakeHttp([body]);
  const result = await createCombosApi(http).list({ page: 2, status: 'draft', q: 'rice' });
  assert.deepEqual(calls, [
    { method: 'GET', url: '/admin/combos', body: undefined, params: { page: 2, limit: 20, status: 'draft', q: 'rice' } },
  ]);
  assert.deepEqual(result, body);
});

// ── endpoints ─────────────────────────────────────────────────────────────────
test('every operation uses the documented admin route and verb', async () => {
  const { http, calls } = fakeHttp([combo(), combo(), combo(), combo(), combo(), {}, image(1), [image(1)], image(1), undefined]);
  const api = createCombosApi(http);
  await api.get(ID);
  await api.create({ name: 'N', price: 1, totalQuantity: 1 });
  await api.update(ID, { name: 'M' });
  await api.publish(ID);
  await api.unpublish(ID);
  await api.presignImage(ID, { contentType: 'image/png', sizeBytes: 10 });
  await api.confirmImage(ID, { uploadId: 'u' });
  await api.reorderImages(ID, ['a', 'b']);
  await api.updateImageAlt(ID, 'img', 'alt');
  await api.removeImage(ID, 'img');
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [
      `GET /admin/combos/${ID}`,
      'POST /admin/combos',
      `PATCH /admin/combos/${ID}`,
      `POST /admin/combos/${ID}/publish`,
      `POST /admin/combos/${ID}/unpublish`,
      `POST /admin/combos/${ID}/images/presign`,
      `POST /admin/combos/${ID}/images/confirm`,
      `PUT /admin/combos/${ID}/images/order`,
      `PATCH /admin/combos/${ID}/images/img`,
      `DELETE /admin/combos/${ID}/images/img`,
    ],
  );
  assert.deepEqual(calls[7].body, { imageIds: ['a', 'b'] });
  assert.deepEqual(calls[8].body, { altText: 'alt' });
});

test('ids are URL-encoded so they cannot alter the path', async () => {
  const { http, calls } = fakeHttp([combo()]);
  await createCombosApi(http).get('a/../../users');
  assert.equal(calls[0].url, '/admin/combos/a%2F..%2F..%2Fusers');
});

test('there is no delete-combo operation (the backend intentionally has none)', () => {
  const api = createCombosApi(fakeHttp().http);
  assert.deepEqual(Object.keys(api).sort(), [
    'confirmImage', 'create', 'get', 'list', 'presignImage', 'publish', 'removeImage',
    'reorderImages', 'unpublish', 'update', 'updateImageAlt',
  ]);
});

// ── publish / unpublish ───────────────────────────────────────────────────────
test('publish and unpublish return the server-confirmed combo', async () => {
  const { http } = fakeHttp([combo({ status: 'published' }), combo({ status: 'unpublished' })]);
  const api = createCombosApi(http);
  assert.equal((await api.publish(ID)).status, 'published');
  assert.equal((await api.unpublish(ID)).status, 'unpublished');
});

test('publish failure propagates (nothing is assumed) and a 409 reads as an instruction', async () => {
  const { http } = fakeHttp([httpError(409, 'Add at least one image before publishing this combo')]);
  await assert.rejects(createCombosApi(http).publish(ID), (e) => {
    const text = explainProblem(describeApiError(e), 'publish');
    assert.match(text, /Add at least one image before publishing this combo/);
    assert.match(text, /Images section, then publish again/);
    return true;
  });
});

test('unpublish failure surfaces the backend message', () => {
  const text = explainProblem(describeApiError(httpError(404, 'Combo not found')), 'unpublish');
  assert.match(text, /could not be found/);
});

// ── error mapping ─────────────────────────────────────────────────────────────
test('409 on save keeps the backend message (allocated stock / frozen slug / taken slug)', () => {
  for (const message of [
    'Total quantity cannot be reduced below the 30 unit(s) already allocated to orders (minimum allowed: 30).',
    'The slug cannot be changed once a combo has been published',
    'The slug "x-y" is already in use',
  ]) {
    const text = explainProblem(describeApiError(httpError(409, message)), 'save');
    assert.ok(text.startsWith(message), text);
    assert.match(text, /Nothing was changed/);
  }
});

test('validation errors (400) with several messages are all shown', () => {
  const p = describeApiError(httpError(400, ['name must be longer', 'price must not be less than 0.01']));
  assert.deepEqual(p.messages, ['name must be longer', 'price must not be less than 0.01']);
  assert.match(explainProblem(p, 'save'), /name must be longer.*price must not be less/);
});

test('403 explains that the feature is admin-only', () => {
  assert.match(explainProblem(describeApiError(httpError(403, 'Forbidden resource')), 'load'), /administrators/);
});

test('no response at all is reported as a connection problem, not a crash', () => {
  const p = describeApiError(networkError());
  assert.equal(p.status, null);
  assert.match(p.message, /Could not reach the server/);
});

test('an HTML 5xx from a proxy does not leak markup', () => {
  const err = Object.assign(new Error('x'), { response: { status: 500, data: '<html>boom</html>' } });
  const text = explainProblem(describeApiError(err), 'load');
  assert.ok(!text.includes('<html>'));
  assert.match(text, /500/);
});
