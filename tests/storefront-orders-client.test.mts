import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleStoreRequest } from '../src/lib/server/store-bff.ts';
import {
  isOrderNumber, issueMessage, paymentSettled, parseCheckoutUrl, parseCustomerOrder, parseOrderList, parseOrderSummary, parseProfile, parseQuote,
  orderStateLabel, quoteIsPurchasable, stageMessage, timelineLabel,
} from '../src/lib/storefront/orders.ts';
import { friendlyMessage, kindOf, messageOf, storeRequest } from '../src/lib/storefront/store-client.ts';

const ENV = { STOREFRONT_ENABLED: 'true', BFF_SHARED_SECRET: 'test-secret-0123456789abcdef0123456789', BACKEND_URL: 'http://backend.test', VERCEL: '1' };
// A syntactically valid JWT (header.payload.signature); the BFF only checks the shape.
const JWT = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"sub":"x"}').toString('base64url')}.${Buffer.from('sig').toString('base64url')}`;

const orderWire = (over: Record<string, unknown> = {}) => ({
  orderNumber: 'ENE-ABCD2345', state: 'awaiting_payment', paymentState: 'unpaid', currency: 'NGN', subtotal: 30000, total: 30000,
  items: [{ slug: 'rice', name: 'Rice', quantity: 2, unitPrice: 15000, lineTotal: 30000 }],
  contact: { name: 'Ada', phone: '+2348031234567', note: null }, canPay: true, canCancel: true, expiresAt: '2026-11-05T10:00:00Z',
  paidAt: null, createdAt: '2026-11-05T09:45:00Z', paymentReference: null, timeline: [{ event: 'created', at: '2026-11-05T09:45:00Z' }, { event: 'internal_secret', at: 'x' }],
  ...over,
});

/** The browser's `fetch`, wired to the REAL customer BFF in front of a fake backend. */
function browser(answer: (url: URL, init: RequestInit) => Response, cookie?: string) {
  const backendCalls: Array<{ url: URL; init: RequestInit }> = [];
  const backend = (async (url: URL | string, init: RequestInit) => {
    backendCalls.push({ url: new URL(String(url)), init });
    return answer(new URL(String(url)), init);
  }) as unknown as typeof fetch;
  const fetcher = async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://storefront.internal');
    const headers = new Headers(init?.headers);
    headers.set('host', 'storefront.internal');
    if ((init?.method ?? 'GET') !== 'GET') headers.set('origin', 'http://storefront.internal');
    if (cookie) headers.set('cookie', cookie);
    const segments = url.pathname.replace(/^\/api\/store\//, '').split('/');
    return handleStoreRequest(new Request(url, { method: init?.method, headers, body: init?.body as BodyInit | undefined }), segments, { env: ENV, fetch: backend });
  };
  return { fetcher, backendCalls };
}
const json = (body: unknown, status = 200) => Response.json(body, { status });

// ── parsing ───────────────────────────────────────────────────────────────────
test('an order is parsed field by field: unknown fields and unknown timeline events are dropped, not carried', () => {
  const order = parseCustomerOrder({ ...orderWire(), customerId: 'leak', id: 'leak', providerTransactionId: 'leak' });
  assert.ok(order);
  assert.deepEqual(Object.keys(order).sort(), [
    'canCancel', 'canPay', 'contact', 'createdAt', 'currency', 'expiresAt', 'fulfilment', 'fulfilmentMethod', 'items', 'orderNumber', 'paidAt', 'paymentReference',
    'paymentState', 'state', 'subtotal', 'timeline', 'total',
  ]);
  assert.equal(order.timeline.length, 2); // parser keeps well-formed entries; labels for unknown events fall back in the UI
});

test('malformed orders, lists and quotes are rejected instead of half-rendered', () => {
  assert.equal(parseCustomerOrder(null), null);
  assert.equal(parseCustomerOrder(orderWire({ state: 'hacked' })), null);
  assert.equal(parseCustomerOrder(orderWire({ orderNumber: '../x' })), null);
  assert.equal(parseCustomerOrder(orderWire({ total: '30000' })), null);
  assert.equal(parseCustomerOrder(orderWire({ items: [{ slug: 'x' }] })), null);
  assert.equal(parseOrderSummary({}), null);
  assert.equal(parseOrderList({ data: [{}], meta: {} }), null);
  assert.equal(parseQuote({ lines: [{ slug: 1 }], limits: {} }), null);
  assert.equal(parseCheckoutUrl({}), null);
  assert.equal(parseProfile({ customerName: 'A' }), null);
  assert.equal(isOrderNumber('ENE-ABCD2345'), true);
  assert.equal(isOrderNumber('ENE-abcd2345'), false);
});

test('quote parsing and purchasability', () => {
  const q = parseQuote({
    currency: 'NGN', total: 30000, withinOrderLimit: true, limits: { maxPerLine: 5, maxPerOrder: 8 },
    lines: [{ slug: 'rice', name: 'Rice', quantity: 2, unitPrice: 15000, lineTotal: 30000, purchasable: true, issue: null }],
  });
  assert.ok(q && quoteIsPurchasable(q));
  const bad = parseQuote({
    currency: 'NGN', total: 0, withinOrderLimit: true, limits: { maxPerLine: 5, maxPerOrder: 8 },
    lines: [{ slug: 'gone', name: null, quantity: 1, unitPrice: null, lineTotal: null, purchasable: false, issue: 'unavailable' }],
  });
  assert.ok(bad && !quoteIsPurchasable(bad));
  assert.equal(issueMessage('insufficient_stock'), 'Not enough left for this quantity');
  assert.equal(issueMessage('quantity_limit', { maxPerLine: 5 }), 'At most 5 per order');
  assert.equal(parseQuote({ currency: 'NGN', total: 0, withinOrderLimit: false, limits: { maxPerLine: 5, maxPerOrder: 8 }, lines: [] })?.lines.length, 0);
});

test('payment-return stops asking the API only on a settled state, and never on a browser-supplied status', () => {
  assert.equal(paymentSettled({ state: 'paid', paymentState: 'paid' }), true);
  assert.equal(paymentSettled({ state: 'under_review', paymentState: 'under_review' }), true);
  assert.equal(paymentSettled({ state: 'expired', paymentState: 'unpaid' }), true);
  assert.equal(paymentSettled({ state: 'awaiting_payment', paymentState: 'awaiting_payment' }), false);
  assert.equal(paymentSettled({ state: 'awaiting_payment', paymentState: 'failed' }), false); // may be retried
});

// ── error handling ────────────────────────────────────────────────────────────
test('failure kinds and messages', () => {
  assert.equal(kindOf(401), 'unauthenticated');
  assert.equal(kindOf(409), 'conflict');
  assert.equal(kindOf(429), 'rate_limited');
  assert.equal(kindOf(502), 'unavailable');
  assert.equal(kindOf(500), 'error');
  assert.equal(messageOf({ message: ['a must be x', 'b must be y'] }, 400), 'a must be x. b must be y');
  assert.match(messageOf(null, 429), /Too many attempts/);
  const f = { ok: false as const, kind: 'conflict' as const, status: 409, code: 'INSUFFICIENT_STOCK', message: 'raw' };
  assert.match(friendlyMessage(f), /run low or sold out/);
  assert.equal(friendlyMessage({ ...f, code: 'SOMETHING_NEW', message: 'api words' }), 'api words');
});

// ── through the REAL BFF ──────────────────────────────────────────────────────
test('create order: the cookie becomes Authorization server-side; the body carries slug, quantity and requestId only', async () => {
  const b = browser(() => json(orderWire(), 201), `ene_cust=${JWT}`);
  const r = await storeRequest({
    path: 'storefront/orders', method: 'POST', fetcher: b.fetcher, parse: parseCustomerOrder,
    body: { items: [{ slug: 'rice', quantity: 2 }], requestId: '11111111-1111-4111-8111-111111111111' },
  });
  assert.equal(r.ok, true);
  const call = b.backendCalls[0];
  assert.equal(call.url.pathname, '/api/v1/storefront/orders');
  assert.equal(new Headers(call.init.headers).get('authorization'), `Bearer ${JWT}`);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(call.init.body as Uint8Array)), { items: [{ slug: 'rice', quantity: 2 }], requestId: '11111111-1111-4111-8111-111111111111' });
});

test('the browser cannot supply its own Authorization to the order endpoints', async () => {
  const b = browser(() => json(orderWire()), `ene_cust=${JWT}`);
  const wrapped = (input: string, init?: RequestInit) => b.fetcher(input, { ...init, headers: { ...(init?.headers as object), authorization: 'Bearer attacker' } });
  await storeRequest({ path: 'storefront/orders/ENE-ABCD2345', fetcher: wrapped, parse: parseCustomerOrder });
  assert.equal(new Headers(b.backendCalls[0].init.headers).get('authorization'), `Bearer ${JWT}`);
});

test('pay, refresh, cancel and quote all reach their API routes', async () => {
  const seen: string[] = [];
  const b = browser((url) => {
    seen.push(url.pathname);
    if (url.pathname.endsWith('/pay')) return json({ checkoutUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/x' });
    if (url.pathname.endsWith('/quote')) return json({ currency: 'NGN', total: 0, withinOrderLimit: true, limits: { maxPerLine: 5, maxPerOrder: 8 }, lines: [] });
    return json(orderWire());
  }, `ene_cust=${JWT}`);
  const pay = await storeRequest({ path: 'storefront/orders/ENE-ABCD2345/pay', method: 'POST', body: {}, fetcher: b.fetcher, parse: parseCheckoutUrl });
  assert.deepEqual(pay.ok && pay.data, 'https://checkout.flutterwave.com/v3/hosted/pay/x');
  assert.equal((await storeRequest({ path: 'storefront/orders/ENE-ABCD2345/payment/refresh', method: 'POST', body: {}, fetcher: b.fetcher, parse: parseCustomerOrder })).ok, true);
  assert.equal((await storeRequest({ path: 'storefront/orders/ENE-ABCD2345/cancel', method: 'POST', body: {}, fetcher: b.fetcher, parse: parseCustomerOrder })).ok, true);
  assert.equal((await storeRequest({ path: 'storefront/cart/quote', method: 'POST', body: { items: [{ slug: 'rice', quantity: 1 }] }, fetcher: b.fetcher, parse: parseQuote })).ok, true);
  assert.deepEqual(seen, [
    '/api/v1/storefront/orders/ENE-ABCD2345/pay', '/api/v1/storefront/orders/ENE-ABCD2345/payment/refresh',
    '/api/v1/storefront/orders/ENE-ABCD2345/cancel', '/api/v1/storefront/cart/quote',
  ]);
});

test('the payment webhook and staff endpoints are unreachable from the browser', async () => {
  const b = browser(() => json({ leaked: true }), `ene_cust=${JWT}`);
  for (const path of ['storefront/payments/flutterwave/webhook', 'admin/storefront-orders', 'auth/login-staff', '../admin/orders']) {
    const r = await storeRequest({ path, method: 'POST', body: {}, fetcher: b.fetcher, parse: (j) => j });
    assert.equal(r.ok, false, path);
  }
  assert.equal(b.backendCalls.length, 0);
});

test('API refusals keep their code and become friendly messages; 401 means unauthenticated', async () => {
  const b = browser(() => json({ success: false, message: 'There is not enough stock for a combo in your cart', code: 'INSUFFICIENT_STOCK' }, 409), `ene_cust=${JWT}`);
  const r = await storeRequest({ path: 'storefront/orders', method: 'POST', body: { items: [{ slug: 'rice', quantity: 1 }] }, fetcher: b.fetcher, parse: parseCustomerOrder });
  assert.ok(!r.ok && r.kind === 'conflict' && r.code === 'INSUFFICIENT_STOCK');
  assert.ok(!r.ok && /run low or sold out/.test(friendlyMessage(r)));

  const anon = browser(() => json({ success: false, message: 'Please sign in to continue' }, 401));
  const me = await storeRequest({ path: 'storefront/auth/me', fetcher: anon.fetcher, parse: parseProfile });
  assert.ok(!me.ok && me.kind === 'unauthenticated');
});

test('a transport failure is "unavailable", a malformed success body is an error, neither throws', async () => {
  const down = await storeRequest({ path: 'storefront/orders', fetcher: async () => { throw new Error('offline'); }, parse: parseOrderList });
  assert.ok(!down.ok && down.kind === 'unavailable' && down.status === 0);
  const odd = await storeRequest({ path: 'storefront/orders', fetcher: async () => Response.json({ nope: true }), parse: parseOrderList });
  assert.ok(!odd.ok && odd.kind === 'error');
});

// ── fulfilment stages, as the customer sees them ───────────────────────────────
test('the customer sees On its way for delivery, Ready for pickup for pickup, and Received when done', () => {
  assert.equal(orderStateLabel('processing', 'delivery'), 'Being prepared');
  assert.equal(orderStateLabel('dispatched', 'delivery'), 'On its way');
  assert.equal(orderStateLabel('dispatched', 'pickup'), 'Ready for pickup');
  assert.equal(orderStateLabel('completed', 'delivery'), 'Received');
  assert.equal(orderStateLabel('completed', 'pickup'), 'Received');
  assert.equal(orderStateLabel('dispatched', null), 'Ready for pickup'); // no recorded method reads as pickup
  assert.equal(orderStateLabel('paid', 'delivery'), 'Paid'); // other states do not change with the method
  assert.equal(timelineLabel('dispatched', 'delivery'), 'On its way');
  assert.equal(timelineLabel('completed', 'pickup'), 'Received');
  assert.equal(timelineLabel('payment_confirmed'), 'Payment confirmed');
  assert.equal(timelineLabel('something_new'), 'Update');
});

test('the order page says something plain once fulfilment starts, and nothing before', () => {
  assert.equal(stageMessage('paid'), null);
  assert.equal(stageMessage('awaiting_payment'), null);
  assert.equal(stageMessage('cancelled'), null);
  assert.match(stageMessage('processing') as string, /preparing/);
  assert.match(stageMessage('dispatched', 'delivery') as string, /on its way/);
  assert.match(stageMessage('dispatched', 'pickup') as string, /collect it/);
  assert.match(stageMessage('completed', 'delivery') as string, /received/);
  assert.match(stageMessage('completed', 'pickup') as string, /received/);
});

test('an order in the new dispatched state parses, with its method from the list or the detail', () => {
  const wire = { ...orderWire(), state: 'dispatched', paymentState: 'paid' };
  assert.equal(parseOrderSummary({ ...wire, fulfilmentMethod: 'delivery' })?.fulfilmentMethod, 'delivery');
  assert.equal(parseOrderSummary({ ...wire, fulfilmentMethod: 'bogus' })?.fulfilmentMethod, null);
  assert.equal(parseOrderSummary(wire)?.state, 'dispatched');
});
