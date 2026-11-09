import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentReturnOutcome, paymentSettled, type CustomerOrder, type OrderState, type PaymentState } from '../src/lib/storefront/orders.ts';

const STATES: OrderState[] = ['awaiting_payment', 'paid', 'processing', 'dispatched', 'completed', 'cancelled', 'expired', 'under_review'];
const PAYMENTS: PaymentState[] = ['unpaid', 'awaiting_payment', 'paid', 'failed', 'under_review', 'refunded'];

const order = (state: OrderState, paymentState: PaymentState, over: Partial<CustomerOrder> = {}): CustomerOrder =>
  ({
    orderNumber: 'ENE-ABCD2345', state, paymentState, fulfilmentMethod: 'delivery', currency: 'NGN', total: 30000, subtotal: 30000,
    createdAt: '2026-11-05T09:45:00Z', canPay: false, canCancel: false, expiresAt: null, paidAt: null, paymentReference: null,
    items: [], timeline: [], contact: { name: null, phone: null, note: null },
    fulfilment: { method: 'delivery', deliveryFee: 0 },
    ...over,
  }) as unknown as CustomerOrder;

test('paid: confirmed, next step follows the order stage', () => {
  const justPaid = paymentReturnOutcome(order('paid', 'paid'), 'done');
  assert.equal(justPaid.kind, 'paid');
  assert.equal(justPaid.headline, 'Payment confirmed');
  assert.match(justPaid.body ?? '', /we will prepare it/);
  assert.deepEqual(justPaid.actions, ['view_order', 'continue_shopping']);
  const dispatched = paymentReturnOutcome(order('dispatched', 'paid'), 'done');
  assert.equal(dispatched.kind, 'paid');
  assert.doesNotMatch(dispatched.body ?? '', /we will prepare it/);
});

test('pending: still confirming while polling, with no actions and no verdict', () => {
  const o = paymentReturnOutcome(order('awaiting_payment', 'awaiting_payment', { canPay: true }), 'checking');
  assert.equal(o.kind, 'pending');
  assert.equal(o.headline, 'Confirming your payment…');
  assert.deepEqual(o.actions, []);
});

test('pending past the polling limit becomes the safe "still waiting" message', () => {
  const o = paymentReturnOutcome(order('awaiting_payment', 'awaiting_payment', { canPay: true }), 'timeout');
  assert.equal(o.kind, 'timeout');
  assert.match(o.body ?? '', /do not pay again/);
  assert.deepEqual(o.actions, ['check_again', 'view_order', 'try_again']);
  assert.deepEqual(paymentReturnOutcome(order('awaiting_payment', 'awaiting_payment', { canPay: false }), 'timeout').actions, ['check_again', 'view_order']);
});

test('under review: tells the customer not to pay again and never offers payment', () => {
  const o = paymentReturnOutcome(order('under_review', 'under_review', { canPay: true }), 'done');
  assert.equal(o.kind, 'under_review');
  assert.match(o.body ?? '', /do not need to pay again/);
  assert.ok(!o.actions.includes('try_again'));
});

test('failed: can try again only when the API says the order is still payable', () => {
  const payable = paymentReturnOutcome(order('awaiting_payment', 'failed', { canPay: true }), 'done');
  assert.equal(payable.kind, 'failed');
  assert.deepEqual(payable.actions, ['try_again', 'view_order']);
  const closed = paymentReturnOutcome(order('awaiting_payment', 'failed', { canPay: false }), 'done');
  assert.deepEqual(closed.actions, ['view_order', 'my_orders']);
});

test('cancelled and expired: closed orders with the contact-us guidance and no payment action', () => {
  for (const state of ['cancelled', 'expired'] as const) {
    const o = paymentReturnOutcome(order(state, 'unpaid', { canPay: true }), 'done');
    assert.equal(o.kind, 'closed');
    assert.equal(o.headline, state === 'expired' ? 'This order expired' : 'This order was cancelled');
    assert.ok(!o.actions.includes('try_again'));
  }
});

test('refunded: says so explicitly, whatever stage the order is in, and never offers to pay', () => {
  for (const state of STATES) {
    for (const canPay of [false, true]) {
      const o = paymentReturnOutcome(order(state, 'refunded', { canPay }), 'done');
      assert.equal(o.kind, 'refunded', `order state ${state}`);
      assert.equal(o.headline, 'Your payment was refunded');
      assert.doesNotMatch(o.headline + (o.body ?? ''), /Confirming/);
      assert.deepEqual(o.actions, ['view_order', 'continue_shopping']);
    }
  }
});

test('every settled combination has an explicit outcome (nothing settled falls through to "Confirming")', () => {
  for (const state of STATES) {
    for (const paymentState of PAYMENTS) {
      const o = order(state, paymentState);
      if (paymentSettled(o)) assert.notEqual(paymentReturnOutcome(o, 'done').kind, 'pending', `${state}/${paymentState}`);
    }
  }
});

test('"Try payment again" is only ever offered for an order that can still be paid and has no captured/refunded/reviewed payment', () => {
  for (const state of STATES) {
    for (const paymentState of PAYMENTS) {
      for (const canPay of [false, true]) {
        for (const polling of ['checking', 'timeout', 'done'] as const) {
          const o = paymentReturnOutcome(order(state, paymentState, { canPay }), polling);
          if (!o.actions.includes('try_again')) continue;
          assert.equal(canPay, true);
          assert.ok(['unpaid', 'awaiting_payment', 'failed'].includes(paymentState), `${state}/${paymentState}`);
        }
      }
    }
  }
});
