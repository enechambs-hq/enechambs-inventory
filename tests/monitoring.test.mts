import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// A browser-like environment for the real axios client (set up before it loads).
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = { location: { pathname: '/', search: '', assign: () => {} } };
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
(globalThis as Record<string, unknown>).document = { cookie: '' };

const { AxiosError } = await import('axios');
const { default: api } = await import('../src/lib/api.ts');
const { storeRequest } = await import('../src/lib/storefront/store-client.ts');
const { buildMonitoringOptions, scrubEvent, scrubText, tracesSampleRate } = await import('../src/lib/monitoring/config.ts');
const { reportApiFailure, reportBoundaryError, resetReported, routeOf, setCapture, shouldReportStatus } = await import('../src/lib/monitoring/report.ts');

const DSN = 'https://abc123@o123.ingest.sentry.io/456';
const ID = '3f2b8c1e-9d4a-4e7b-8a6f-1c2d3e4f5a6b';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMifQ.c2lnbmF0dXJlLXRleHQ';

type Event = { name: string; message: string; level: string; tags: Record<string, string>; fingerprint: string[] };
let events: Event[] = [];
beforeEach(() => {
  events = [];
  resetReported();
  setCapture((e) => void events.push(e));
});

// ── configuration ─────────────────────────────────────────────────────────────
test('monitoring is off without a DSN or with a malformed one', () => {
  for (const dsn of [undefined, '', 'nope', 'http://abc@host/1', 'https://host/1']) assert.equal(buildMonitoringOptions({ dsn }), null);
});

test('environment, release and conservative sampling; no PII, no breadcrumbs, no replay', () => {
  const o = buildMonitoringOptions({ dsn: DSN, environment: 'production', release: 'abc1234', nodeEnv: 'production' })!;
  assert.equal(o.environment, 'production');
  assert.equal(o.release, 'abc1234');
  assert.equal(o.tracesSampleRate, 0.05);
  assert.equal(o.sendDefaultPii, false);
  assert.equal(o.maxBreadcrumbs, 0);
  assert.equal(o.beforeBreadcrumb(), null);
  assert.ok(!('replaysSessionSampleRate' in o) && !('integrations' in o), 'no session replay');
  assert.equal(buildMonitoringOptions({ dsn: DSN, nodeEnv: 'development' })!.environment, 'development');
  assert.equal(tracesSampleRate('1'), 0.2);
  assert.equal(tracesSampleRate('abc'), 0.05);
  assert.equal(tracesSampleRate('0'), 0);
});

test('ordinary browser noise is ignored', () => {
  const o = buildMonitoringOptions({ dsn: DSN })!;
  assert.ok(o.ignoreErrors.some((p) => String(p).includes('ResizeObserver')));
  assert.ok(o.denyUrls.some((r) => r.test('chrome-extension://abc/x.js')));
});

// ── scrubbing ─────────────────────────────────────────────────────────────────
test('scrubText removes emails, tokens, ids, phone numbers and order numbers', () => {
  const out = scrubText(`failed for ada.obi@example.com with ${JWT} id ${ID} phone +2348031234567 order ENE-ABCD2345 key ${'a'.repeat(40)}`);
  for (const secret of ['ada.obi', JWT, ID, '8031234567', 'ENE-ABCD2345', 'a'.repeat(40)]) assert.ok(!out.includes(secret), secret);
});

test('scrubEvent strips user, request headers/cookies/body/query, breadcrumbs and scrubs exception text', () => {
  const e = scrubEvent({
    user: { email: 'a@b.com' }, extra: { x: 1 }, breadcrumbs: [{ message: 'x' }], server_name: 'host',
    request: { method: 'POST', url: `https://app.test/admin/orders?email=a@b.com&token=${JWT}`, headers: { cookie: 'token=secret' }, data: { password: 'p' } },
    exception: { values: [{ type: 'Error', value: `bad ${JWT} for ada.obi@example.com` }] },
    contexts: { browser: { name: 'Chrome' }, device: { model: 'x' } },
    tags: { requestId: ID },
  });
  const json = JSON.stringify(e);
  for (const secret of [JWT, 'ada.obi', 'secret', 'token=', 'password', 'host']) assert.ok(!json.includes(secret), secret);
  assert.deepEqual(e.request, { method: 'POST', url: '/admin/orders' });
  assert.deepEqual(e.tags, { requestId: ID });
  assert.deepEqual(e.contexts, { browser: { name: 'Chrome' } });
});

// ── what is and is not an incident ────────────────────────────────────────────
test('only server faults are incidents; expected 4xx and offline failures never are', () => {
  for (const status of [500, 502, 503, 504, 599]) assert.equal(shouldReportStatus(status), true, String(status));
  for (const status of [undefined, 0, 200, 304, 400, 401, 403, 404, 409, 422, 429, 499]) assert.equal(shouldReportStatus(status), false, String(status));
  for (const status of [400, 401, 403, 404, 409, 422, 429, undefined]) assert.equal(reportApiFailure({ status, source: 'staff', url: '/x' }), false);
  assert.equal(events.length, 0);
});

test('a 5xx is reported with method, route (no query, no ids), status, code and request id', () => {
  const sent = reportApiFailure({ status: 500, method: 'get', url: '/admin/storefront-orders/ENE-ABCD2345?token=abc&email=a@b.com', code: 'INTERNAL_ERROR', requestId: ID, source: 'staff' });
  assert.equal(sent, true);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].tags, { source: 'staff', 'http.method': 'GET', 'http.route': '/admin/storefront-orders/:id', 'http.status_code': '500', 'error.code': 'INTERNAL_ERROR', requestId: ID });
  assert.equal(events[0].message, 'API 500 GET /admin/storefront-orders/:id');
  assert.deepEqual(events[0].fingerprint, ['api-server-error', 'staff', 'GET', '/admin/storefront-orders/:id', '500']);
  const json = JSON.stringify(events[0]);
  for (const secret of ['ENE-ABCD2345', 'token=abc', 'a@b.com']) assert.ok(!json.includes(secret));
});

test('route normalisation drops ids, query strings and odd input', () => {
  assert.equal(routeOf('/api/v1/orders/3f2b8c1e-9d4a-4e7b-8a6f-1c2d3e4f5a6b/pay?x=1#y'), '/api/v1/orders/:id/pay');
  assert.equal(routeOf('https://api.test/a/12345/b'), '/a/:id/b');
  assert.equal(routeOf(undefined), '[unknown]');
  assert.equal(routeOf('no-slash'), '[unknown]');
});

test('duplicates: one incident per request id, and an identical repeating failure at most once a minute', () => {
  assert.equal(reportApiFailure({ status: 500, url: '/x', requestId: ID, source: 'staff' }, 1_000), true);
  assert.equal(reportApiFailure({ status: 500, url: '/y', requestId: ID, source: 'staff' }, 2_000), false, 'same request id');
  assert.equal(reportApiFailure({ status: 500, url: '/z', source: 'staff' }, 3_000), true);
  assert.equal(reportApiFailure({ status: 500, url: '/z', source: 'staff' }, 10_000), false, 'same failure within a minute (a poller)');
  assert.equal(reportApiFailure({ status: 500, url: '/z', source: 'staff' }, 70_000), true, 'a minute later it is reported again');
  assert.equal(events.length, 3);
});

test('an unsafe tag value (not an id-like string) is dropped rather than sent', () => {
  reportApiFailure({ status: 500, url: '/x', code: 'has spaces and <b>html</b>', requestId: 'a b c', source: 'staff' });
  assert.equal(events[0].tags['error.code'], undefined);
  assert.equal(events[0].tags.requestId, undefined);
});

test('nothing is sent when no capture is installed (monitoring off)', () => {
  setCapture(null);
  assert.equal(reportApiFailure({ status: 500, url: '/x', source: 'staff' }), false);
  assert.equal(reportBoundaryError(new Error('x'), 'segment'), false);
});

test('an error-boundary exception is reported with a scrubbed message and only the digest tagged', () => {
  const error = Object.assign(new TypeError(`Cannot read ${JWT} of ada.obi@example.com`), { digest: '1234567890' });
  assert.equal(reportBoundaryError(error, 'segment'), true);
  assert.equal(events[0].name, 'TypeError');
  assert.deepEqual(events[0].tags, { boundary: 'segment', digest: '1234567890' });
  const json = JSON.stringify(events[0]);
  assert.ok(!json.includes('ada.obi') && !json.includes(JWT));
  assert.equal(reportBoundaryError(error, 'segment'), false, 'the same crash re-rendering is not reported twice');
});

// ── wired into the real clients ───────────────────────────────────────────────
function respondWith(status: number, data: unknown, headers: Record<string, string> = {}) {
  api.defaults.adapter = async (config) => {
    throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers, config, data });
  };
}

test('the staff axios client reports a 500 once (with the API request id) and never a 401, 403, 404, 409 or 429', async () => {
  respondWith(500, { success: false, code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: ID }, { 'x-request-id': ID });
  await api.get('/admin/storefront-orders/ENE-ABCD2345?token=secret').catch(() => {});
  assert.equal(events.length, 1);
  assert.equal(events[0].tags.requestId, ID);
  assert.equal(events[0].tags['http.route'], '/admin/storefront-orders/:id');
  assert.ok(!JSON.stringify(events[0]).includes('secret'));
  for (const status of [401, 403, 404, 409, 429, 400]) {
    respondWith(status, { message: 'x' });
    await api.get('/admin/x').catch(() => {});
  }
  assert.equal(events.length, 1);
});

test('the staff client still passes the original error through unchanged', async () => {
  respondWith(503, { message: 'down' });
  const error = (await api.get('/x').then(() => null, (e: unknown) => e)) as InstanceType<typeof AxiosError>;
  assert.equal(error.response?.status, 503);
});

test('the customer client reports only server faults, without body, cookies or query', async () => {
  const fail = (status: number) => async () => new Response(JSON.stringify({ message: 'x', requestId: ID }), { status, headers: { 'content-type': 'application/json', 'x-request-id': ID } });
  for (const status of [400, 401, 404, 409, 429]) await storeRequest({ path: `storefront/orders/ENE-ABCD2345?e=a@b.com`, parse: () => ({}), fetcher: fail(status) });
  assert.equal(events.length, 0);
  await storeRequest({ path: 'storefront/orders/ENE-ABCD2345?e=a@b.com', method: 'POST', body: { password: 'secret' }, parse: () => ({}), fetcher: fail(502) });
  assert.equal(events.length, 1);
  assert.equal(events[0].tags.source, 'storefront');
  assert.equal(events[0].tags['http.route'], '/api/store/storefront/orders/:id');
  assert.equal(events[0].tags.requestId, ID);
  const json = JSON.stringify(events[0]);
  assert.ok(!json.includes('secret') && !json.includes('a@b.com'));
});

test('a customer-side network failure (no answer) is not an incident', async () => {
  await storeRequest({ path: 'storefront/orders', parse: () => ({}), fetcher: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(events.length, 0);
});
