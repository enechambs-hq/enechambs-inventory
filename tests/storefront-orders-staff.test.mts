import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  awaitsLatePaymentDecision, customRangeError, fulfilmentAction, formatLagosDateTime, formatNaira, fulfilmentTargets, lagosRangeToInstants, orderWarnings,
  paymentDeadline, refundablePayments,
} from '../src/lib/storefront-orders/format.ts';
import { buildCustomerListParams, buildOrderListParams, buildReportParams, createStorefrontOrdersApi, type HttpClient } from '../src/lib/storefront-orders/orders-api.ts';
import type { AdminOrderDetail, AdminOrderRow, AdminPayment } from '../src/types/storefront-orders.ts';

const row = (over: Partial<AdminOrderRow> = {}): AdminOrderRow => ({
  orderNumber: 'ENE-ABCD2345', status: 'confirmed', paymentStatus: 'paid', reviewReason: null, currency: 'NGN', total: 30000,
  createdAt: '2026-11-04T10:00:00Z', paidAt: '2026-11-04T10:05:00Z', expiresAt: '2026-11-04T10:15:00Z', customerName: 'Ada Obi',
  customerPhone: '+2348031234567', customerEmail: 'ada@example.com', itemCount: 2, awaitingPayment: false, chargeCount: 1, ...over,
});
const pay = (over: Partial<AdminPayment> = {}): AdminPayment => ({
  id: 'p1', txRef: 'ENE-X-abc', providerTransactionId: '123', status: 'paid', reconciliation: null, amount: 30000, currency: 'NGN',
  verifiedAmount: 30000, verifiedCurrency: 'NGN', capturedAt: '2026-11-04T10:05:00Z', refundedAt: null, resolutionNote: null,
  createdAt: '2026-11-04T10:01:00Z', ...over,
});

function fakeHttp(answer: unknown = {}) {
  const calls: Array<{ method: string; url: string; body?: unknown; params?: unknown }> = [];
  const http: HttpClient = {
    get: async (url, config) => (calls.push({ method: 'GET', url, params: config?.params }), { data: answer as never, status: 200 }),
    post: async (url, body) => (calls.push({ method: 'POST', url, body }), { data: answer as never, status: 200 }),
    patch: async (url, body) => (calls.push({ method: 'PATCH', url, body }), { data: answer as never, status: 200 }),
  };
  return { http, calls };
}

// ── list query ────────────────────────────────────────────────────────────────
test('list params: defaults, only meaningful filters, Lagos day bounds (to is exclusive, the next midnight)', () => {
  assert.deepEqual(buildOrderListParams(), { page: 1, limit: 10 });
  assert.deepEqual(
    buildOrderListParams({ page: 3, limit: 500, search: '  ENE-AB ', status: 'confirmed', paymentStatus: 'review', needsReview: true, fromDate: '2026-11-01', toDate: '2026-11-30' }),
    { page: 3, limit: 50, search: 'ENE-AB', status: 'confirmed', paymentStatus: 'review', needsReview: true, from: '2026-11-01T00:00:00+01:00', to: '2026-12-01T00:00:00+01:00' },
  );
  assert.deepEqual(buildOrderListParams({ status: '', paymentStatus: '', search: '   ', needsReview: false, fromDate: 'nope', toDate: '2026-02-30', page: -2, limit: 0 }), { page: 1, limit: 10 });
  assert.equal((buildOrderListParams({ search: 'x'.repeat(100) }).search as string).length, 30);
});

test('a single Lagos day covers exactly 24 hours: 00:00 to 24:00 Lagos', () => {
  assert.deepEqual(lagosRangeToInstants('2026-11-04', '2026-11-04'), { from: '2026-11-04T00:00:00+01:00', to: '2026-11-05T00:00:00+01:00' });
  assert.equal(Date.parse('2026-11-05T00:00:00+01:00') - Date.parse('2026-11-04T00:00:00+01:00'), 86_400_000);
  // 23:30 UTC on the 4th is 00:30 on the 5th in Lagos: outside the 4th, inside the 5th.
  const t = Date.parse('2026-11-04T23:30:00Z');
  const d4 = lagosRangeToInstants('2026-11-04', '2026-11-04');
  assert.ok(!(t >= Date.parse(d4.from!) && t < Date.parse(d4.to!)));
  const d5 = lagosRangeToInstants('2026-11-05', '2026-11-05');
  assert.ok(t >= Date.parse(d5.from!) && t < Date.parse(d5.to!));
});

test('report params and custom range validation', () => {
  assert.deepEqual(buildReportParams({ range: 'last7' }), { range: 'last7' });
  assert.deepEqual(buildReportParams({ range: 'last7', from: '2026-01-01', to: '2026-02-01' }), { range: 'last7' }); // presets ignore stray dates
  assert.deepEqual(buildReportParams({ range: 'custom', from: '2026-11-01', to: '2026-11-04' }), { range: 'custom', from: '2026-11-01', to: '2026-11-04' });
  assert.equal(customRangeError('2026-11-01', '2026-11-04'), null);
  assert.match(customRangeError('', '2026-11-04') ?? '', /both/);
  assert.match(customRangeError('2026-11-05', '2026-11-04') ?? '', /after/);
  assert.match(customRangeError('2026-02-30', '2026-03-01') ?? '', /valid/);
  assert.match(customRangeError('2025-01-01', '2026-12-31') ?? '', /at most 366/);
});

// ── the API surface ───────────────────────────────────────────────────────────
test('the client exposes ONLY list, get, fulfilment, honour, refund, report and the read-only customers list: no way to mark paid or edit money', () => {
  const api = createStorefrontOrdersApi(fakeHttp().http);
  assert.deepEqual(Object.keys(api).sort(), ['customers', 'get', 'honourLatePayment', 'list', 'recordRefund', 'report', 'updateFulfilment']);
});

test('each call goes to the right backend route with the right verb and body', async () => {
  const { http, calls } = fakeHttp({ data: [], meta: {}, payments: [], items: [], history: [] });
  const api = createStorefrontOrdersApi(http);
  await api.list({ page: 2 });
  await api.get('ENE-ABCD2345');
  await api.updateFulfilment('ENE-ABCD2345', 'processing');
  await api.honourLatePayment('ENE-ABCD2345', '  stock confirmed  ');
  await api.recordRefund('ENE-ABCD2345', 'a/b c', '  customer withdrew ');
  await api.report({ range: 'today' });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    'GET /admin/storefront-orders',
    'GET /admin/storefront-orders/ENE-ABCD2345',
    'PATCH /admin/storefront-orders/ENE-ABCD2345/fulfilment',
    'POST /admin/storefront-orders/ENE-ABCD2345/honour-late-payment',
    'POST /admin/storefront-orders/ENE-ABCD2345/payments/a%2Fb%20c/record-refund',
    'GET /admin/storefront-reports',
  ]);
  assert.deepEqual(calls[2].body, { status: 'processing' });
  assert.deepEqual(calls[3].body, { note: 'stock confirmed' });
  assert.deepEqual(calls[4].body, { note: 'customer withdrew' });
  assert.deepEqual(calls[5].params, { range: 'today' });
});

test('path segments are encoded: an order number cannot climb out of its route', async () => {
  const { http, calls } = fakeHttp({ payments: [], items: [], history: [] });
  await createStorefrontOrdersApi(http).get('../users/1?x=y#z');
  assert.equal(calls[0].url, '/admin/storefront-orders/..%2Fusers%2F1%3Fx%3Dy%23z');
});

test('numbers arrive as numbers even if the API sends decimal strings; missing arrays do not crash', async () => {
  const { http } = fakeHttp({
    data: [{ ...row(), total: '30000.50', itemCount: '3', chargeCount: '1' }], meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
  });
  const list = await createStorefrontOrdersApi(http).list();
  assert.equal(list.data[0].total, 30000.5);
  assert.equal(list.data[0].itemCount, 3);
  const detail = await createStorefrontOrdersApi(fakeHttp({ orderNumber: 'ENE-ABCD2345', subtotal: '10.10', total: '10.10', payments: [{ ...pay(), amount: '10.10', verifiedAmount: null }] }).http).get('ENE-ABCD2345');
  assert.equal(detail.total, 10.1);
  assert.equal(detail.payments[0].verifiedAmount, null);
  assert.deepEqual(detail.history, []);
  assert.deepEqual(detail.items, []);
});

// ── what to offer ─────────────────────────────────────────────────────────────
test('fulfilment is offered only for PAID orders, only forward', () => {
  assert.deepEqual(fulfilmentTargets({ status: 'confirmed', paymentStatus: 'paid' }), ['processing']);
  assert.deepEqual(fulfilmentTargets({ status: 'processing', paymentStatus: 'paid' }), ['dispatched']);
  assert.deepEqual(fulfilmentTargets({ status: 'dispatched', paymentStatus: 'paid' }), ['completed']);
  for (const status of ['pending', 'completed', 'cancelled', 'expired'] as const) assert.deepEqual(fulfilmentTargets({ status, paymentStatus: 'paid' }), [], status);
  for (const paymentStatus of ['unpaid', 'review', 'refunded', 'failed'] as const) assert.deepEqual(fulfilmentTargets({ status: 'confirmed', paymentStatus }), [], paymentStatus);
});

test('late-payment and refund decisions are offered only where the backend would accept them', () => {
  assert.equal(awaitsLatePaymentDecision({ status: 'expired', paymentStatus: 'review', reviewReason: 'late_payment' }), true);
  assert.equal(awaitsLatePaymentDecision({ status: 'cancelled', paymentStatus: 'review', reviewReason: 'late_payment' }), true);
  assert.equal(awaitsLatePaymentDecision({ status: 'confirmed', paymentStatus: 'paid', reviewReason: null }), false);
  assert.equal(awaitsLatePaymentDecision({ status: 'expired', paymentStatus: 'review', reviewReason: 'duplicate_charge' }), false);
  const payments = [pay(), pay({ id: 'late', reconciliation: 'late_payment' }), pay({ id: 'q', status: 'quarantined', reconciliation: 'amount_mismatch' }), pay({ id: 'done', status: 'refunded', reconciliation: 'duplicate_charge' }), pay({ id: 'init', status: 'initiated', capturedAt: null })];
  assert.deepEqual(refundablePayments({ payments }).map((p) => p.id), ['late', 'q']);
});

test('the payment deadline shows only while waiting for payment, and flags an overdue one', () => {
  const now = new Date('2026-11-04T10:10:00Z');
  assert.equal(paymentDeadline(row({ awaitingPayment: false }), now), null);
  assert.deepEqual(paymentDeadline(row({ awaitingPayment: true, expiresAt: '2026-11-04T10:15:00Z' }), now), { label: formatLagosDateTime('2026-11-04T10:15:00Z'), overdue: false });
  assert.equal(paymentDeadline(row({ awaitingPayment: true, expiresAt: '2026-11-04T10:05:00Z' }), now)?.overdue, true);
});

test('warning chips', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  assert.deepEqual(orderWarnings(row(), now), []);
  assert.deepEqual(orderWarnings(row({ reviewReason: 'late_payment', paymentStatus: 'review' }), now).map((w) => w.key), ['late_payment']);
  assert.deepEqual(orderWarnings(row({ chargeCount: 2 }), now).map((w) => w.key), ['multi']);
  assert.deepEqual(orderWarnings(row({ status: 'pending', paymentStatus: 'unpaid', awaitingPayment: true, expiresAt: '2026-11-04T11:00:00Z' }), now).map((w) => w.key), ['overdue']);
});

// ── formatting ────────────────────────────────────────────────────────────────
test('naira and Lagos time formatting', () => {
  assert.equal(formatNaira(30000), '₦30,000');
  assert.equal(formatNaira(30000.3), '₦30,000.3');
  assert.equal(formatNaira(-10000.1), '-₦10,000.1');
  assert.equal(formatNaira(Number.NaN), '₦0');
  // 23:30 UTC is 00:30 the next day in Lagos, whatever the viewer's own time zone.
  assert.match(formatLagosDateTime('2026-11-04T23:30:00Z'), /5 Nov 2026/);
  assert.equal(formatLagosDateTime(null), '—');
  assert.equal(formatLagosDateTime('garbage'), '—');
});

test('the detail type has everything the detail page shows (compile-time contract)', () => {
  const d: AdminOrderDetail = {
    orderNumber: 'ENE-ABCD2345', status: 'confirmed', paymentStatus: 'paid', reviewReason: null, currency: 'NGN', subtotal: 1, total: 1, expiresAt: '', stockRestoredAt: null,
    paidAt: null, createdAt: '', customer: { name: 'A', phone: '1', email: null }, fulfilment: {}, items: [], payments: [], history: [], paymentEvents: [],
  };
  assert.equal(d.items.length, 0);
});

// ── online customers ──────────────────────────────────────────────────────────
test('customer list params: defaults, a capped page size and a trimmed, bounded search', () => {
  assert.deepEqual(buildCustomerListParams(), { page: 1, limit: 10 });
  assert.deepEqual(buildCustomerListParams({ page: 2, limit: 500, search: '  ada ' }), { page: 2, limit: 50, search: 'ada' });
  assert.deepEqual(buildCustomerListParams({ page: -1, limit: 0, search: '   ' }), { page: 1, limit: 10 });
  assert.equal((buildCustomerListParams({ search: 'x'.repeat(300) }).search as string).length, 100);
});

test('customers: calls the admin endpoint and turns money and counts into numbers', async () => {
  const { http, calls } = fakeHttp({
    data: [{ id: 'c1', customerName: 'Ada', customerPhone: '+2348031234567', customerEmail: 'ada@example.com', joinedAt: '2026-11-01T10:00:00Z', lastLoginAt: null, orderCount: '2', paidOrderCount: '1', totalPaid: '30000.00', lastOrderAt: null }],
    meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
  });
  const res = await createStorefrontOrdersApi(http).customers({ search: 'ada' });
  assert.deepEqual(calls, [{ method: 'GET', url: '/admin/storefront-customers', params: { page: 1, limit: 10, search: 'ada' } }]);
  assert.equal(res.data[0].orderCount, 2);
  assert.equal(res.data[0].paidOrderCount, 1);
  assert.equal(res.data[0].totalPaid, 30000);
  assert.equal(res.meta.total, 1);
});

// ── the fulfilment steps and their wording ─────────────────────────────────────
test('each fulfilment step reads right for delivery and for pickup, and says what the customer will see', () => {
  assert.equal(fulfilmentAction('processing', 'delivery').label, 'Start processing');
  assert.equal(fulfilmentAction('dispatched', 'delivery').label, 'Mark as sent out');
  assert.equal(fulfilmentAction('dispatched', 'pickup').label, 'Mark as ready for pickup');
  assert.equal(fulfilmentAction('completed', 'delivery').label, 'Mark as delivered');
  assert.equal(fulfilmentAction('completed', 'pickup').label, 'Mark as collected');
  // no recorded method (an order from before delivery existed) reads as pickup, like the emails
  assert.equal(fulfilmentAction('dispatched', undefined).label, 'Mark as ready for pickup');
  assert.equal(fulfilmentAction('completed', null).label, 'Mark as collected');
  for (const t of ['processing', 'dispatched', 'completed'] as const) {
    for (const m of ['delivery', 'pickup'] as const) assert.match(fulfilmentAction(t, m).question, /emailed/, `${t} ${m}`);
  }
  assert.match(fulfilmentAction('completed', 'delivery').question, /cannot be undone/);
});
