import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelReasonError, cancellationPanel, createSubmitGuard, refundReferenceError, runDecision,
} from '../src/lib/storefront-orders/cancellation.ts';
import { fulfilmentTargets, HISTORY_EVENT_LABEL, orderWarnings } from '../src/lib/storefront-orders/format.ts';
import { createStorefrontOrdersApi, NO_CANCELLATION, type HttpClient } from '../src/lib/storefront-orders/orders-api.ts';
import {
  orderStateLabel, paymentReturnOutcome, paymentSettled, parseOrderSummary, PAYMENT_STATE_LABEL, stageMessage, timelineLabel,
  type CustomerOrder, type OrderState, type PaymentState,
} from '../src/lib/storefront/orders.ts';
import type { AdminCancellation, AdminOrderDetail, AdminOrderRow } from '../src/types/storefront-orders.ts';

const cancellation = (over: Partial<AdminCancellation> = {}): AdminCancellation => ({ ...NO_CANCELLATION, ...over });
const detail = (over: Partial<AdminOrderDetail> = {}): AdminOrderDetail =>
  ({ orderNumber: 'ENE-ABCD2345', status: 'confirmed', paymentStatus: 'paid', cancellation: NO_CANCELLATION, payments: [], items: [], history: [], paymentEvents: [], fulfilment: {}, ...over }) as unknown as AdminOrderDetail;
const requested = (over: Partial<AdminCancellation> = {}) =>
  cancellation({ state: 'requested', reason: 'Cannot deliver', refundAmount: 50000, canWithdraw: true, canStartRefund: true, ...over });
const started = (over: Partial<AdminCancellation> = {}) =>
  cancellation({ state: 'refund_started', reason: 'Cannot deliver', refundAmount: 50000, canRecordRefund: true, canRecordFailedRefund: true, ...over });

// ── eligible and ineligible actions ───────────────────────────────────────────
test('an administrator is offered "request cancellation" only when the backend says the order is eligible', () => {
  assert.deepEqual(cancellationPanel(detail({ cancellation: cancellation({ canRequest: true }) }), true), { mode: 'request' });
  // staff are never offered it, even if the backend flag is set
  assert.deepEqual(cancellationPanel(detail({ cancellation: cancellation({ canRequest: true }) }), false), { mode: 'hidden' });
  // dispatched / unpaid / flagged orders: the backend says canRequest=false, so nothing is offered
  assert.deepEqual(cancellationPanel(detail({ status: 'dispatched', cancellation: cancellation({ blockedReason: 'already dispatched' }) }), true), { mode: 'hidden' });
  assert.deepEqual(cancellationPanel(detail({ cancellation: undefined }), true), { mode: 'hidden' });
});

test('requested: the administrator may start the refund or withdraw; recording is not offered yet', () => {
  assert.deepEqual(cancellationPanel(detail({ cancellation: requested() }), true), { mode: 'requested', reason: 'Cannot deliver', refundAmount: 50000, canStartRefund: true, canWithdraw: true, blockedReason: null });
  const staff = cancellationPanel(detail({ cancellation: requested() }), false) as { mode: string; canStartRefund: boolean; canWithdraw: boolean };
  assert.equal(staff.mode, 'requested');
  assert.equal(staff.canStartRefund, false);
  assert.equal(staff.canWithdraw, false);
});

test('refund started: NO withdrawal or second start; only recording the refund or its failure', () => {
  const p = cancellationPanel(detail({ cancellation: started() }), true);
  assert.deepEqual(p, { mode: 'refund_started', reason: 'Cannot deliver', refundAmount: 50000, canRecordRefund: true, canRecordFailedRefund: true, blockedReason: null });
  assert.ok(!('canWithdraw' in p) && !('canStartRefund' in p));
  // even if a stale flag said otherwise, the started panel never offers withdrawal
  assert.ok(!('canWithdraw' in cancellationPanel(detail({ cancellation: started({ canWithdraw: true }) }), true)));
  const staff = cancellationPanel(detail({ cancellation: started() }), false) as { canRecordRefund: boolean; canRecordFailedRefund: boolean };
  assert.deepEqual([staff.canRecordRefund, staff.canRecordFailedRefund], [false, false]);
  const flagged = cancellationPanel(detail({ cancellation: started({ canRecordRefund: false, blockedReason: 'needs review' }) }), true) as { canRecordRefund: boolean; canRecordFailedRefund: boolean; blockedReason: string };
  assert.deepEqual([flagged.canRecordRefund, flagged.canRecordFailedRefund, flagged.blockedReason], [false, true, 'needs review']);
});

test('after completion there are no actions: withdrawal is impossible', () => {
  const p = cancellationPanel(detail({ status: 'cancelled', paymentStatus: 'refunded', cancellation: cancellation({ state: 'completed', canWithdraw: true, canRecordRefund: true }) }), true);
  assert.deepEqual(p, { mode: 'completed' });
});

test('a pending cancellation blocks every fulfilment step in the UI (the backend refuses them too)', () => {
  assert.deepEqual(fulfilmentTargets(detail({ status: 'confirmed' })), ['processing']);
  assert.deepEqual(fulfilmentTargets(detail({ status: 'processing', cancellation: requested() })), []);
  assert.deepEqual(fulfilmentTargets(detail({ status: 'processing', cancellation: started() })), []);
  assert.deepEqual(fulfilmentTargets({ status: 'processing', paymentStatus: 'paid', cancellationPending: true }), []);
  assert.deepEqual(fulfilmentTargets({ status: 'processing', paymentStatus: 'paid', cancellationPending: false }), ['dispatched']);
});

test('the order list flags a pending cancellation', () => {
  const row = { status: 'confirmed', paymentStatus: 'paid', reviewReason: null, chargeCount: 1, awaitingPayment: false, expiresAt: '2026-11-04T10:15:00Z', cancellationPending: true } as unknown as AdminOrderRow;
  assert.ok(orderWarnings(row).some((w) => w.key === 'cancelling' && /Cancellation pending/.test(w.label)));
  assert.ok(!orderWarnings({ ...row, cancellationPending: false }).some((w) => w.key === 'cancelling'));
});

test('the timeline names the started and failed refund events', () => {
  assert.match(HISTORY_EVENT_LABEL.refund_started, /cannot be withdrawn/);
  assert.match(HISTORY_EVENT_LABEL.refund_attempt_failed, /failed/);
});

test('the timeline names the new events distinctly: a request is never "refunded"', () => {
  assert.match(HISTORY_EVENT_LABEL.cancellation_requested, /refund pending/i);
  assert.equal(HISTORY_EVENT_LABEL.cancellation_withdrawn, 'Cancellation withdrawn');
  assert.doesNotMatch(timelineLabel('cancellation_requested'), /completed|refunded/i);
});

// ── validation ────────────────────────────────────────────────────────────────
test('the cancellation reason is mandatory (trimmed, 3 to 400 characters)', () => {
  assert.match(cancelReasonError('') ?? '', /Enter the reason/);
  assert.match(cancelReasonError('    ') ?? '', /Enter the reason/);
  assert.match(cancelReasonError('ab') ?? '', /at least 3/);
  assert.match(cancelReasonError('x'.repeat(401)) ?? '', /at most 400/);
  assert.equal(cancelReasonError('  Cannot deliver  '), null);
});

test('the refund reference is mandatory and matches the backend rule exactly', () => {
  for (const bad of ['', '   ', 'ab', 'has space', 'bad/é', '-starts-with-dash', 'x'.repeat(101), 'a b c', '<script>']) {
    assert.notEqual(refundReferenceError(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
  for (const good of ['RF-1001', '  RF-1001  ', '1234567', 'abc.def_ghi:jkl/mno-pq', 'x'.repeat(100)]) {
    assert.equal(refundReferenceError(good), null, `should accept ${JSON.stringify(good)}`);
  }
});

// ── the API client ────────────────────────────────────────────────────────────
function fakeHttp(answer: unknown = {}) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const http: HttpClient = {
    get: async (url) => (calls.push({ method: 'GET', url }), { data: answer as never, status: 200 }),
    post: async (url, body) => (calls.push({ method: 'POST', url, body }), { data: answer as never, status: 200 }),
    patch: async (url, body) => (calls.push({ method: 'PATCH', url, body }), { data: answer as never, status: 200 }),
  };
  return { http, calls };
}

test('request / record / withdraw call the right routes; the refund call has NO amount', async () => {
  const { http, calls } = fakeHttp({ orderNumber: 'ENE-ABCD2345', cancellation: { state: 'requested', refundAmount: '50000.00' } });
  const api = createStorefrontOrdersApi(http);
  await api.requestCancellation('ENE-ABCD2345', '  Cannot deliver ');
  await api.recordCancellationRefund('ENE-ABCD2345', '  RF-1001 ');
  await api.withdrawCancellation('ENE-ABCD2345', ' changed my mind ');
  await api.startCancellationRefund('ENE-ABCD2345');
  await api.recordFailedCancellationRefund('ENE-ABCD2345', ' it failed ');
  assert.deepEqual(calls, [
    { method: 'POST', url: '/admin/storefront-orders/ENE-ABCD2345/request-cancellation', body: { reason: 'Cannot deliver' } },
    { method: 'POST', url: '/admin/storefront-orders/ENE-ABCD2345/record-cancellation-refund', body: { refundReference: 'RF-1001' } },
    { method: 'POST', url: '/admin/storefront-orders/ENE-ABCD2345/withdraw-cancellation', body: { note: 'changed my mind' } },
    { method: 'POST', url: '/admin/storefront-orders/ENE-ABCD2345/start-cancellation-refund', body: {} },
    { method: 'POST', url: '/admin/storefront-orders/ENE-ABCD2345/record-failed-cancellation-refund', body: { note: 'it failed' } },
  ]);
  assert.ok(!('amount' in (calls[1].body as object)));
});

test('the detail is normalised: refund amount becomes a number, and an older API means no cancellation', async () => {
  const withIt = await createStorefrontOrdersApi(fakeHttp({ orderNumber: 'ENE-ABCD2345', cancellation: { state: 'refund_started', refundAmount: '50000.00', canRecordRefund: true } }).http).get('ENE-ABCD2345');
  assert.equal(withIt.cancellation?.refundAmount, 50000);
  assert.equal(withIt.cancellation?.state, 'refund_started');
  assert.equal(withIt.cancellation?.canWithdraw, false);
  const without = await createStorefrontOrdersApi(fakeHttp({ orderNumber: 'ENE-ABCD2345' }).http).get('ENE-ABCD2345');
  assert.deepEqual(without.cancellation, NO_CANCELLATION);
});

// ── failed operations preserve the dialog and input ───────────────────────────
test('a failed operation reports a message, never "applied", and never closes the dialog or clears input', async () => {
  const guard = createSubmitGuard();
  const ui = { open: true, input: 'RF-1001', error: null as string | null, order: null as { ok: boolean } | null };
  const outcome = await runDecision<{ ok: boolean }>(guard, async () => { throw new Error('boom'); }, () => 'We could not save that.', {
    onApplied: (o) => { ui.order = o; ui.open = false; ui.input = ''; },
    onFailed: (m) => { ui.error = m; },
  });
  assert.equal(outcome, 'failed');
  assert.deepEqual({ ...ui }, { open: true, input: 'RF-1001', error: 'We could not save that.', order: null });
  assert.equal(guard.busy, false); // can retry immediately
  const retry = await runDecision(guard, async () => ({ ok: true }), () => '', { onApplied: (o) => { ui.order = o; ui.open = false; }, onFailed: () => {} });
  assert.equal(retry, 'applied');
  assert.deepEqual(ui.order, { ok: true });
  assert.equal(ui.open, false);
});

test('duplicate submissions are ignored: one request in flight at a time', async () => {
  const guard = createSubmitGuard();
  let calls = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  const slow = async () => { calls += 1; await gate; return 'done'; };
  const applied: string[] = [];
  const handlers = { onApplied: (v: string) => applied.push(v), onFailed: () => {} };
  const first = runDecision(guard, slow, () => '', handlers);
  const second = await runDecision(guard, slow, () => '', handlers);
  const third = await runDecision(guard, slow, () => '', handlers);
  assert.equal(second, 'ignored');
  assert.equal(third, 'ignored');
  assert.equal(guard.busy, true);
  release();
  assert.equal(await first, 'applied');
  assert.equal(calls, 1);
  assert.deepEqual(applied, ['done']);
  assert.equal(guard.busy, false);
});

// ── what the customer sees ────────────────────────────────────────────────────
const customerOrder = (state: OrderState, paymentState: PaymentState): CustomerOrder =>
  ({ orderNumber: 'ENE-ABCD2345', state, paymentState, fulfilmentMethod: 'delivery', currency: 'NGN', total: 50000, subtotal: 50000, createdAt: '2026-11-05T09:45:00Z', canPay: false, canCancel: false, expiresAt: null, paidAt: null, paymentReference: null, items: [], timeline: [], contact: { name: null, phone: null, note: null }, fulfilment: { method: 'delivery', deliveryFee: 0 } }) as unknown as CustomerOrder;

const RAW = /[a-z]+_[a-z]+/; // any snake_case identifier

test('customers can tell requested, refund in progress, completed and ordinary states apart', () => {
  assert.equal(orderStateLabel('cancellation_pending'), 'Cancellation requested');
  assert.equal(orderStateLabel('refund_processing'), 'Refund in progress');
  assert.equal(orderStateLabel('cancelled'), 'Cancelled');
  assert.equal(PAYMENT_STATE_LABEL.refund_pending, 'Refund not started yet');
  assert.match(PAYMENT_STATE_LABEL.refund_processing, /in progress, not confirmed yet/);
  assert.equal(PAYMENT_STATE_LABEL.refunded, 'Refunded');
  const order = new Set([orderStateLabel('paid'), orderStateLabel('cancellation_pending'), orderStateLabel('refund_processing'), orderStateLabel('cancelled')]);
  assert.equal(order.size, 4);
  const pay = new Set([PAYMENT_STATE_LABEL.paid, PAYMENT_STATE_LABEL.refund_pending, PAYMENT_STATE_LABEL.refund_processing, PAYMENT_STATE_LABEL.refunded]);
  assert.equal(pay.size, 4);
});

test('no customer-facing label, message or outcome contains an internal state name', () => {
  const texts: string[] = [];
  for (const st of ['awaiting_payment', 'paid', 'processing', 'dispatched', 'completed', 'cancelled', 'expired', 'cancellation_pending', 'refund_processing', 'under_review'] as OrderState[]) {
    texts.push(orderStateLabel(st, 'delivery'), orderStateLabel(st, 'pickup'), stageMessage(st, 'delivery') ?? '', stageMessage(st, 'pickup') ?? '');
  }
  for (const st of Object.values(PAYMENT_STATE_LABEL)) texts.push(st);
  for (const ev of ['cancellation_requested', 'cancellation_withdrawn', 'refund_recorded', 'refund_started', 'refund_attempt_failed']) texts.push(timelineLabel(ev));
  for (const [o, p] of [['cancellation_pending', 'refund_pending'], ['refund_processing', 'refund_processing'], ['cancelled', 'refunded']] as Array<[OrderState, PaymentState]>) {
    const r = paymentReturnOutcome(customerOrder(o, p), 'done');
    texts.push(r.headline, r.body ?? '');
  }
  for (const t of texts) assert.doesNotMatch(t, RAW, `leaks an internal name: ${t}`);
});

test('the list parser accepts the new states (and still rejects unknown ones)', () => {
  const base = { orderNumber: 'ENE-ABCD2345', total: 50000, createdAt: '2026-11-05T09:45:00Z', currency: 'NGN', canPay: false };
  assert.equal(parseOrderSummary({ ...base, state: 'cancellation_pending', paymentState: 'refund_pending' })?.state, 'cancellation_pending');
  assert.equal(parseOrderSummary({ ...base, state: 'refund_processing', paymentState: 'refund_processing' })?.paymentState, 'refund_processing');
  assert.equal(parseOrderSummary({ ...base, state: 'cancelled', paymentState: 'refunded' })?.paymentState, 'refunded');
  assert.equal(parseOrderSummary({ ...base, state: 'refunding', paymentState: 'refund_pending' }), null);
});

test('requested: says cancellation requested and the refund is NOT made yet', () => {
  const msg = stageMessage('cancellation_pending', 'delivery') ?? '';
  assert.match(msg, /request to cancel/);
  assert.match(msg, /has not been made yet/);
  assert.doesNotMatch(msg, /has been refunded|was refunded|refund is complete|refund has started|started your refund/i);
  const r = paymentReturnOutcome(customerOrder('cancellation_pending', 'refund_pending'), 'done');
  assert.equal(r.kind, 'refund_pending');
  assert.match(r.body ?? '', /has not been made yet/);
  assert.ok(!r.actions.includes('try_again'));
});

test('refund in progress: says started and NOT confirmed, never that it completed', () => {
  const msg = stageMessage('refund_processing', 'delivery') ?? '';
  assert.match(msg, /started your refund/);
  assert.match(msg, /not confirmed yet/);
  assert.doesNotMatch(msg, /has been refunded|was refunded|refund is complete|has been issued/i);
  const r = paymentReturnOutcome(customerOrder('refund_processing', 'refund_processing'), 'done');
  assert.equal(r.kind, 'refund_processing');
  assert.match(r.headline, /in progress/);
  assert.match(r.body ?? '', /not confirmed yet/);
  assert.ok(!r.actions.includes('try_again'));
  assert.equal(paymentSettled(customerOrder('refund_processing', 'refund_processing')), true);
});

test('completed: cancelled and refunded, and only that state says refunded', () => {
  const done = paymentReturnOutcome(customerOrder('cancelled', 'refunded'), 'done');
  assert.equal(done.kind, 'refunded');
  assert.match(done.headline, /refunded/);
  for (const [o, p] of [['cancellation_pending', 'refund_pending'], ['refund_processing', 'refund_processing']] as Array<[OrderState, PaymentState]>) {
    assert.doesNotMatch(paymentReturnOutcome(customerOrder(o, p), 'done').headline, /was refunded|refunded$/i);
  }
});

test('ordinary paid, unpaid, delivered and cancelled presentations are unchanged', () => {
  assert.equal(orderStateLabel('paid'), 'Paid');
  assert.equal(orderStateLabel('awaiting_payment'), 'Awaiting payment');
  assert.equal(orderStateLabel('completed', 'delivery'), 'Received');
  assert.equal(orderStateLabel('cancelled'), 'Cancelled');
  assert.equal(PAYMENT_STATE_LABEL.paid, 'Paid');
  assert.equal(PAYMENT_STATE_LABEL.unpaid, 'Not paid');
  assert.equal(paymentReturnOutcome(customerOrder('paid', 'paid'), 'done').kind, 'paid');
  assert.equal(paymentReturnOutcome(customerOrder('cancelled', 'unpaid'), 'done').kind, 'closed');
  assert.equal(stageMessage('paid'), null);
});

test('the customer timeline labels requested, withdrawn and recorded separately; internal events never show', () => {
  assert.equal(timelineLabel('cancellation_requested'), 'Cancellation requested');
  assert.equal(timelineLabel('refund_recorded'), 'Refund recorded');
  assert.equal(timelineLabel('cancellation_withdrawn'), 'Cancellation withdrawn');
  assert.equal(timelineLabel('refund_started'), 'Update'); // the API never sends it; if it did, nothing internal is shown
});
