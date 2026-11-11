import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ERROR_KINDS, FALLBACK_MESSAGES, isAppError, makeAppError } from '../src/lib/errors/app-error.ts';
import {
  fromAxiosError, fromCatalogueFailure, fromStoreFailure, isRetryable, kindFromStatus, messageForKind, normalizeError, safeCode, safeServerMessage,
} from '../src/lib/errors/normalize.ts';
import { appErrorFromStore } from '../src/lib/errors/store-adapter.ts';
import { appErrorFromStaff } from '../src/lib/errors/staff-adapter.ts';
import { failed, loaded, loading, viewOf } from '../src/lib/errors/load-state.ts';
import { panelModel } from '../src/lib/errors/panel-model.ts';
import { storeRequest, type StoreFailure } from '../src/lib/storefront/store-client.ts';
import { httpError, networkError } from './combos-support.mts';

/** An axios-shaped rejection, as the staff client produces it. */
const axiosFail = (status: number, data: unknown, method = 'get', headers: Record<string, string> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, config: { method }, response: { status, data, headers } });
const axiosNoResponse = (code: string, message: string, method = 'get') => Object.assign(new Error(message), { isAxiosError: true, code, config: { method } });
const storeFail = (kind: StoreFailure['kind'], status: number, message = 'x', code?: string): StoreFailure => ({ ok: false, kind, status, message, ...(code ? { code } : {}) });

// ── every kind and the status mappings ───────────────────────────────────────

test('status codes map to kinds', () => {
  const expected: Array<[number, string]> = [
    [400, 'validation'], [401, 'unauthenticated'], [403, 'forbidden'], [404, 'not_found'], [409, 'conflict'], [422, 'validation'],
    [429, 'rate_limited'], [500, 'unexpected'], [502, 'unavailable'], [503, 'unavailable'], [504, 'timeout'],
  ];
  for (const [status, kind] of expected) assert.equal(kindFromStatus(status), kind, String(status));
});

test('every kind has a safe fallback message, and none looks technical', () => {
  assert.equal(Object.keys(FALLBACK_MESSAGES).length, ERROR_KINDS.length);
  for (const kind of ERROR_KINDS) {
    const text = FALLBACK_MESSAGES[kind];
    assert.ok(text.length > 10 && text.endsWith('.') || text.endsWith('?'), kind);
    assert.doesNotMatch(text, /exception|stack|status code|\d{3}/i, kind);
  }
});

test('network failures (axios and fetch shapes) are "network" and retryable for a GET', () => {
  for (const e of [axiosNoResponse('ERR_NETWORK', 'Network Error'), networkError(), new TypeError('Failed to fetch'), new TypeError('fetch failed')]) {
    const err = normalizeError(e, { method: 'GET' });
    assert.equal(err.kind, 'network');
    assert.equal(err.status, undefined);
    assert.equal(err.retryable, true);
    assert.equal(err.message, FALLBACK_MESSAGES.network);
  }
});

test('timeouts are recognised: axios client timeout, DOM TimeoutError and the proxy 504', () => {
  assert.equal(normalizeError(axiosNoResponse('ECONNABORTED', 'timeout of 35000ms exceeded')).kind, 'timeout');
  assert.equal(normalizeError(new DOMException('x', 'TimeoutError'), { method: 'GET' }).kind, 'timeout');
  const proxy = fromAxiosError(axiosFail(504, { success: false, message: 'The service took too long to respond', code: 'UPSTREAM_TIMEOUT' }));
  assert.deepEqual([proxy.kind, proxy.status, proxy.code, proxy.retryable], ['timeout', 504, 'UPSTREAM_TIMEOUT', true]);
  assert.equal(proxy.message, FALLBACK_MESSAGES.timeout);
});

test('the proxy 502 is "unavailable" with its code kept', () => {
  const e = fromAxiosError(axiosFail(502, { success: false, message: 'Service unavailable', code: 'UPSTREAM_UNAVAILABLE' }));
  assert.deepEqual([e.kind, e.status, e.code, e.retryable], ['unavailable', 502, 'UPSTREAM_UNAVAILABLE', true]);
});

test('401, 403, 404, 429 never show the server text and are never retryable', () => {
  const cases: Array<[number, string, string]> = [
    [401, 'unauthenticated', 'Unauthorized'], [403, 'forbidden', 'Forbidden resource'], [404, 'not_found', 'Cannot GET /api/v1/secret-internal'], [429, 'rate_limited', 'ThrottlerException: Too Many Requests'],
  ];
  for (const [status, kind, text] of cases) {
    const e = fromAxiosError(axiosFail(status, { message: text }));
    assert.equal(e.kind, kind);
    assert.equal(e.message, FALLBACK_MESSAGES[kind as keyof typeof FALLBACK_MESSAGES]);
    assert.equal(e.retryable, false);
  }
});

test('503 with a message and a 500: server text is hidden, only transient ones are retryable (GET)', () => {
  assert.equal(fromAxiosError(axiosFail(503, { message: 'maintenance' })).message, FALLBACK_MESSAGES.unavailable);
  const e500 = fromAxiosError(axiosFail(500, { message: 'QueryFailedError: relation "orders" does not exist' }));
  assert.equal(e500.kind, 'unexpected');
  assert.equal(e500.message, FALLBACK_MESSAGES.unexpected);
  assert.equal(e500.retryable, true, 'a manual retry of a safe request is allowed');
  assert.equal(fromAxiosError(axiosFail(500, {}, 'post')).retryable, false);
});

test('409 keeps the API sentence (and the code); a conflict is never retryable', () => {
  const e = fromAxiosError(axiosFail(409, { message: 'Total quantity cannot be lower than the 5 units already allocated', code: 'BELOW_ALLOCATED' }, 'patch'));
  assert.equal(e.kind, 'conflict');
  assert.equal(e.message, 'Total quantity cannot be lower than the 5 units already allocated');
  assert.equal(e.code, 'BELOW_ALLOCATED');
  assert.equal(e.retryable, false);
});

test('validation: a list becomes safe details, and 400 with plain text is not claimed to be field validation', () => {
  const list = fromAxiosError(httpError(400, ['name must be longer than or equal to 2 characters', 'price must not be less than 0.01']));
  assert.equal(list.kind, 'validation');
  assert.deepEqual(list.details, ['name must be longer than or equal to 2 characters', 'price must not be less than 0.01']);
  assert.match(list.message, /name must be longer.*price must not be less/);
  const plain = fromAxiosError(httpError(400, 'Cannot reduce stock below the allocated units'));
  assert.equal(plain.kind, 'validation');
  assert.equal(plain.details, undefined, 'no field details were provided');
  assert.equal(plain.message, 'Cannot reduce stock below the allocated units');
  assert.equal(fromAxiosError(axiosFail(422, { message: ['bad'] })).kind, 'validation');
});

test('unsafe server text is replaced: stacks, SQL, paths, HTML, long text, generic framework answers', () => {
  const unsafe = [
    'Error: boom\n    at handler (/srv/app/dist/orders.js:10:5)', 'duplicate key value violates unique constraint "uq_x"', 'SELECT * FROM users WHERE id = 1',
    'ECONNREFUSED 10.0.0.5:5432', '<html>bad gateway</html>', 'x'.repeat(301), 'Bad Request', 'Internal server error', '',
  ];
  for (const text of unsafe) assert.equal(safeServerMessage(text), null, text.slice(0, 30));
  assert.equal(safeServerMessage('This order can no longer be paid for'), 'This order can no longer be paid for');
  const e = fromAxiosError(axiosFail(409, { message: 'duplicate key value violates unique constraint "uq_x"' }, 'post'));
  assert.equal(e.message, FALLBACK_MESSAGES.conflict);
});

test('an HTML error page and other malformed bodies never reach the message', () => {
  for (const data of ['<html>boom</html>', null, undefined, 42, [], { message: { nested: true } }, { message: ['<b>x</b>', 7, null] }]) {
    const e = fromAxiosError(axiosFail(400, data));
    assert.doesNotMatch(e.message, /<|nested/);
    assert.equal(e.kind, 'validation');
  }
});

test('API codes are kept only when they are well-formed identifiers', () => {
  assert.equal(safeCode('INSUFFICIENT_STOCK'), 'INSUFFICIENT_STOCK');
  for (const bad of ['has space', 'lower_case', '../etc/passwd', '', 5, null, 'X']) assert.equal(safeCode(bad), undefined);
  assert.equal(fromAxiosError(axiosFail(409, { message: 'x', code: 'select * from' })).code, undefined);
});

test('correlation ids are kept from headers or body, and ignored when malformed', () => {
  assert.equal(fromAxiosError(axiosFail(500, {}, 'get', { 'X-Request-Id': 'req_12345abc' })).correlationId, 'req_12345abc');
  assert.equal(fromAxiosError(axiosFail(500, { requestId: 'abc-123-def' })).correlationId, 'abc-123-def');
  assert.equal(fromAxiosError(axiosFail(500, {}, 'get', { 'x-request-id': '<script>' })).correlationId, undefined);
  assert.equal(fromAxiosError(axiosFail(500, {})).correlationId, undefined);
});

// ── unknown / malformed values ───────────────────────────────────────────────

test('unknown and malformed thrown values are "unexpected" with the safe message and never throw', () => {
  const weird: unknown[] = [undefined, null, 'boom', 42, {}, [], () => 1, new Error('secret stack info'), { message: 'token=abc' }, Symbol('x'), Object.create(null), { response: null }];
  for (const w of weird) {
    const e = normalizeError(w);
    assert.equal(e.kind, 'unexpected');
    assert.equal(e.message, FALLBACK_MESSAGES.unexpected);
    assert.equal(e.retryable, false);
    assert.doesNotMatch(JSON.stringify(e), /secret|token=abc/);
  }
});

test('an AppError passes through unchanged', () => {
  const e = makeAppError({ kind: 'forbidden', message: 'm', retryable: false });
  assert.equal(normalizeError(e), e);
  assert.equal(isAppError(e), true);
  assert.equal(isAppError({ kind: 'forbidden', message: 'm', retryable: false }), false);
});

// ── retry classification ─────────────────────────────────────────────────────

test('writes are never retryable, whatever failed', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', undefined]) {
    for (const kind of ERROR_KINDS) assert.equal(isRetryable(kind, kind === 'unexpected' ? 500 : undefined, { method }), false, `${method}/${kind}`);
  }
  assert.equal(fromAxiosError(axiosNoResponse('ERR_NETWORK', 'Network Error', 'post')).retryable, false);
  assert.equal(fromAxiosError(axiosFail(503, {}, 'delete')).retryable, false);
  assert.equal(fromAxiosError(axiosFail(504, {}, 'patch')).retryable, false);
});

test('safe requests are retryable only for transient failures', () => {
  for (const kind of ['network', 'timeout', 'unavailable'] as const) assert.equal(isRetryable(kind, undefined, { method: 'GET' }), true, kind);
  for (const kind of ['unauthenticated', 'forbidden', 'not_found', 'validation', 'conflict', 'rate_limited'] as const) assert.equal(isRetryable(kind, undefined, { method: 'GET' }), false, kind);
  assert.equal(isRetryable('unexpected', undefined, { method: 'GET' }), false, 'an unknown exception is not retried');
  assert.equal(isRetryable('unexpected', 500, { method: 'GET' }), true);
});

test('an idempotent POST (a price quote) can be marked retryable by its owner; nothing else', () => {
  assert.equal(isRetryable('network', undefined, { method: 'POST', idempotent: true }), true);
  assert.equal(isRetryable('conflict', 409, { method: 'POST', idempotent: true }), false);
});

// ── wording with context ─────────────────────────────────────────────────────

test('context fills in neutral, area-specific wording and never mentions promotions', () => {
  assert.equal(messageForKind('forbidden', { what: 'online orders' }), 'You do not have permission to view online orders.');
  assert.equal(messageForKind('forbidden', { action: 'change' }), 'You do not have permission to make this change.');
  assert.equal(messageForKind('not_found', { one: 'order' }), 'We could not find that order. It may have been removed.');
  for (const kind of ERROR_KINDS) assert.doesNotMatch(messageForKind(kind, { what: 'online customers', one: 'customer' }), /combo|promotion/i);
});

// ── adapters ─────────────────────────────────────────────────────────────────

test('storefront adapter: kinds, codes and the existing friendly wording', () => {
  const stock = appErrorFromStore(storeFail('conflict', 409, 'raw api text', 'INSUFFICIENT_STOCK'));
  assert.deepEqual([stock.kind, stock.status, stock.code, stock.retryable], ['conflict', 409, 'INSUFFICIENT_STOCK', false]);
  assert.match(stock.message, /just run low or sold out/);
  assert.equal(appErrorFromStore(storeFail('unauthenticated', 401)).message, 'Please sign in to continue.');
  assert.equal(appErrorFromStore(storeFail('unavailable', 0, 'We could not reach the service. Please try again.'), { method: 'GET' }).kind, 'network');
  assert.equal(appErrorFromStore(storeFail('unavailable', 504), { method: 'GET' }).kind, 'timeout');
  assert.equal(appErrorFromStore(storeFail('unavailable', 502), { method: 'GET' }).retryable, true);
  assert.equal(appErrorFromStore(storeFail('rate_limited', 429, 'ThrottlerException: Too Many Requests')).message, FALLBACK_MESSAGES.rate_limited);
  assert.equal(appErrorFromStore(storeFail('error', 403, 'Forbidden resource')).kind, 'forbidden', 'the client has no 403 kind; the status decides');
  const server = appErrorFromStore(storeFail('error', 500, 'QueryFailedError: relation "x" does not exist'), { method: 'GET' });
  assert.deepEqual([server.kind, server.message], ['unexpected', FALLBACK_MESSAGES.unexpected]);
});

test('storefront adapter: a failed write is not retryable, and the original failure object is untouched', () => {
  const f = storeFail('unavailable', 502);
  const snapshot = JSON.stringify(f);
  assert.equal(appErrorFromStore(f, { method: 'POST' }).retryable, false);
  assert.equal(JSON.stringify(f), snapshot);
  assert.equal(appErrorFromStore(storeFail('unavailable', 502), { method: 'POST', idempotent: true }).retryable, true);
});

test('storefront adapter works on a REAL storeRequest failure (network down)', async () => {
  const result = await storeRequest({ path: 'storefront/orders', parse: () => null, fetcher: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(result.ok, false);
  if (result.ok) return;
  const e = appErrorFromStore(result, { method: 'GET' });
  assert.deepEqual([e.kind, e.retryable], ['network', true]);
  assert.equal(normalizeError(result, { method: 'GET' }).kind, 'network', 'normalizeError recognises a StoreFailure too');
});

test('catalogue adapter maps server-side read failures (always a GET)', () => {
  assert.equal(fromCatalogueFailure({ kind: 'unavailable', status: 503 }).retryable, true);
  assert.equal(fromCatalogueFailure({ kind: 'unavailable', status: 0 }).kind, 'network');
  assert.equal(fromCatalogueFailure({ kind: 'not_found', status: 404 }).retryable, false);
  assert.equal(fromCatalogueFailure({ kind: 'rate_limited', status: 429 }).kind, 'rate_limited');
  assert.equal(fromCatalogueFailure({ kind: 'error', status: 500 }).kind, 'unexpected');
});

test('staff adapter: reads the method from the axios config, preserves status and code', () => {
  const read = appErrorFromStaff(axiosFail(503, { message: 'x' }, 'get'));
  const write = appErrorFromStaff(axiosFail(503, { message: 'x' }, 'post'));
  assert.deepEqual([read.kind, read.status, read.retryable], ['unavailable', 503, true]);
  assert.equal(write.retryable, false);
  assert.equal(appErrorFromStaff(axiosFail(401, { message: 'Unauthorized' })).kind, 'unauthenticated');
  assert.equal(appErrorFromStaff(axiosFail(403, {})).kind, 'forbidden');
});

// ── load state ───────────────────────────────────────────────────────────────

test('empty is only possible after a successful load; a failure is never "empty"', () => {
  const isEmpty = (rows: unknown[]) => rows.length === 0;
  const err = normalizeError(networkError(), { method: 'GET' });
  assert.equal(viewOf(loading<unknown[]>(), isEmpty), 'loading');
  assert.equal(viewOf(failed<unknown[]>(err), isEmpty), 'error');
  assert.equal(viewOf(loaded<unknown[]>([]), isEmpty), 'empty');
  assert.equal(viewOf(loaded<unknown[]>([1]), isEmpty), 'content');
});

// ── error panel model ────────────────────────────────────────────────────────

test('panel model: retry only when safe AND a handler exists; reference only when present', () => {
  const transient = normalizeError(networkError(), { method: 'GET' });
  assert.equal(panelModel(transient, { hasRetryHandler: true }).showRetry, true);
  assert.equal(panelModel(transient, { hasRetryHandler: false }).showRetry, false);
  const forbidden = normalizeError(httpError(403, 'Forbidden resource'), { method: 'GET', what: 'online orders' });
  const m = panelModel(forbidden, { hasRetryHandler: true });
  assert.equal(m.showRetry, false);
  assert.equal(m.message, 'You do not have permission to view online orders.');
  assert.equal(m.reference, null);
  const write = normalizeError(axiosFail(503, {}, 'post'), {});
  assert.equal(panelModel(write, { hasRetryHandler: true }).showRetry, false);
  const withRef = makeAppError({ kind: 'unexpected', status: 500, message: 'm', retryable: true, correlationId: 'req_abc123' });
  assert.equal(panelModel(withRef, { hasRetryHandler: true, title: 'Custom' }).reference, 'Reference: req_abc123');
  assert.equal(panelModel(withRef, { hasRetryHandler: true, title: 'Custom' }).title, 'Custom');
  assert.equal(panelModel(transient, { hasRetryHandler: true }).title, 'You appear to be offline');
});

// ── message safety: what may come out of a 400 / 409 / 422 ────────────────────

test('server sentences that carry private or internal content are never shown', () => {
  const sensitive = [
    'An account for ada.okafor@example.com already exists', 'Invalid password=Hunter2!x', 'token: abcdef123456', 'secret=shh', 'api key is wrong: sk_live_x',
    'Bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig', 'Authorization: Bearer abcdefgh12345', 'cookie=ene_cust=abc',
    'Phone +2348012345678 is already used', 'Phone 08012345678 is already used', 'Order 12345678901 failed',
    'Customer 3f2a9c1e-1b2c-4d3e-8f90-1234567890ab not allowed', 'Hash deadbeefdeadbeefdeadbeefdeadbeefdeadbeef rejected',
    'Cannot reach 10.0.0.5', 'Failed at postgres:5432', 'See https://enechambs-api.onrender.com/x', 'host db.neon.tech refused', 'enechambs-api.onrender.com timed out',
    'Error reading /srv/app/dist/orders.js', 'Missing C:\\app\\config.js', 'Bad value {"email":"a"}', 'Set DATABASE_URL first', 'process.env.JWT_SECRET is missing', 'localhost refused',
  ];
  for (const text of sensitive) {
    assert.equal(safeServerMessage(text), null, text);
    for (const status of [400, 409, 422]) {
      const e = fromAxiosError(axiosFail(status, { message: text }, 'post'));
      assert.equal(e.message, FALLBACK_MESSAGES[e.kind], `${status}: ${text}`);
      assert.doesNotMatch(JSON.stringify(e), /example\.com|Hunter2|eyJ|08012345678|2348012345678|onrender|neon\.tech|DATABASE_URL|\/srv\/app/);
    }
  }
});

test('a validation list drops only the unsafe entries and keeps the useful ones', () => {
  const e = fromAxiosError(httpError(400, ['name must be longer than or equal to 2 characters', 'email ada@example.com is not allowed', 'price must not be less than 0.01']));
  assert.deepEqual(e.details, ['name must be longer than or equal to 2 characters', 'price must not be less than 0.01']);
  assert.doesNotMatch(JSON.stringify(e), /ada@example\.com/);
  const allBad = fromAxiosError(httpError(400, ['x@y.com bad', 'token=abcdefgh']));
  assert.equal(allBad.details, undefined);
  assert.equal(allBad.message, FALLBACK_MESSAGES.validation);
});

test('ordinary API sentences are still shown', () => {
  for (const text of [
    'This order can no longer be paid for', 'Total quantity cannot be lower than the 5 units already allocated', 'name must be longer than or equal to 2 characters',
    'Add at least one item to "What\'s included" before publishing this combo', 'A record with these details already exists', 'A combo can have at most 8 images',
    'Slug must use lowercase letters and numbers separated by single hyphens', 'Price must not be less than 0.01', 'The start date is after the end date.',
  ]) {
    assert.equal(safeServerMessage(text), text);
  }
});

test('a 5xx or 403/404/429 never shows server text even if it looks harmless', () => {
  for (const status of [401, 403, 404, 429, 500, 502, 503]) {
    const e = fromAxiosError(axiosFail(status, { message: 'Everything is fine here' }));
    assert.equal(e.message, FALLBACK_MESSAGES[e.kind], String(status));
  }
});

// ── retry tightening ─────────────────────────────────────────────────────────

test('only a plain 500 (not 501, 505, ...) counts as a possibly-passing server fault', () => {
  assert.equal(isRetryable('unexpected', 500, { method: 'GET' }), true);
  for (const status of [501, 505, 507, 599, 400]) assert.equal(isRetryable('unexpected', status, { method: 'GET' }), false, String(status));
});

test('an error with no response and no network signal is not assumed to be the network', () => {
  const e = normalizeError(Object.assign(new Error('Cannot read properties of undefined'), { isAxiosError: true, config: { method: 'get' } }));
  assert.equal(e.kind, 'unexpected');
  assert.equal(e.retryable, false);
  assert.equal(normalizeError(axiosNoResponse('ERR_BAD_OPTION', 'bad option')).kind, 'unexpected');
});
