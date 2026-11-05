import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addressErrors,
  addressToInput,
  emptyAddressInput,
  formatAddressLine,
  parseAddress,
  parseAddressList,
  parseCheckoutOptions,
  toRequestAddress,
  toUpdateAddress,
} from '../src/lib/storefront/addresses.ts';
import { parseCustomerOrder, parseFulfilment, parseQuote } from '../src/lib/storefront/orders.ts';
import { safeNextPath } from '../src/lib/storefront/redirects.ts';

const ADDRESS = {
  id: '5f1c2c1e-9b57-4f0e-9d58-0c5d6b5a1111',
  label: 'Mum',
  recipientName: 'Ada Obi',
  recipientPhone: '+2348031234567',
  addressLine: '12 Admiralty Way, Lekki Phase 1',
  city: 'Lagos',
  state: 'Lagos State',
  isDefault: true,
  customerId: 'must-not-leak',
};

const GOOD_INPUT = { ...emptyAddressInput(), recipientName: 'Ada Obi', recipientPhone: '08031234567', addressLine: '12 Admiralty Way', city: 'Lagos', state: 'Lagos State' };

test('an address is parsed field by field and unknown fields are dropped', () => {
  const a = parseAddress(ADDRESS);
  assert.ok(a);
  assert.equal(a.recipientName, 'Ada Obi');
  assert.equal(a.isDefault, true);
  assert.equal('customerId' in a, false);
  assert.equal(parseAddress({ ...ADDRESS, city: undefined }), null);
  assert.equal(parseAddress(null), null);
  assert.equal(parseAddressList('nope'), null);
  assert.equal(parseAddressList([ADDRESS, { id: 'x' }]), null);
  assert.equal(parseAddressList([ADDRESS])?.length, 1);
});

test('the checkout options need a numeric fee and the pickup details', () => {
  assert.deepEqual(parseCheckoutOptions({ deliveryFee: 10000, pickup: { address: 'Our store', hours: '9am - 5pm' } }), {
    deliveryFee: 10000,
    pickup: { address: 'Our store', hours: '9am - 5pm' },
  });
  assert.equal(parseCheckoutOptions({ deliveryFee: '10000', pickup: { address: 'a', hours: 'b' } }), null);
  assert.equal(parseCheckoutOptions({ deliveryFee: 1, pickup: { address: 'a' } }), null);
});

test('address checks name the field that is wrong, and a good address has none', () => {
  assert.deepEqual(addressErrors(GOOD_INPUT), {});
  const bad = addressErrors(emptyAddressInput());
  assert.deepEqual(Object.keys(bad).sort(), ['addressLine', 'city', 'recipientName', 'recipientPhone', 'state']);
  assert.ok(addressErrors({ ...GOOD_INPUT, recipientPhone: '12345' }).recipientPhone);
  assert.ok(addressErrors({ ...GOOD_INPUT, addressLine: 'abc' }).addressLine);
  assert.ok(addressErrors({ ...GOOD_INPUT, label: 'x'.repeat(41) }).label);
});

test('the create body is trimmed and leaves a blank label out; the edit body sends it so it can be cleared', () => {
  const input = { ...GOOD_INPUT, recipientName: '  Ada Obi ', label: '  ', state: ' Lagos ' };
  assert.deepEqual(toRequestAddress(input), { recipientName: 'Ada Obi', recipientPhone: '08031234567', addressLine: '12 Admiralty Way', city: 'Lagos', state: 'Lagos' });
  assert.deepEqual(toUpdateAddress(input), {
    recipientName: 'Ada Obi',
    recipientPhone: '08031234567',
    addressLine: '12 Admiralty Way',
    city: 'Lagos',
    state: 'Lagos',
    label: '',
  });
});

test('the state is required, and there is no landmark', () => {
  assert.equal(addressErrors({ ...GOOD_INPUT, state: '  ' }).state, 'Enter the state.');
  assert.deepEqual(addressErrors(GOOD_INPUT), {});
  assert.equal('landmark' in emptyAddressInput(), false);
  assert.equal('landmark' in toRequestAddress(GOOD_INPUT), false);
});

test('an address round-trips into form values and prints on one line', () => {
  const a = parseAddress(ADDRESS)!;
  assert.deepEqual(addressToInput(a), {
    label: 'Mum',
    recipientName: 'Ada Obi',
    recipientPhone: '+2348031234567',
    addressLine: '12 Admiralty Way, Lekki Phase 1',
    city: 'Lagos',
    state: 'Lagos State',
  });
  assert.equal(formatAddressLine(a), '12 Admiralty Way, Lekki Phase 1, Lagos, Lagos State');
  assert.equal(formatAddressLine({ addressLine: '1 Road', city: 'Abuja', state: null }), '1 Road, Abuja');
});

const QUOTE = {
  currency: 'NGN',
  lines: [{ slug: 'rice-combo', name: 'Rice Combo', quantity: 2, unitPrice: 15000, lineTotal: 30000, purchasable: true, issue: null }],
  withinOrderLimit: true,
  limits: { maxPerLine: 10, maxPerOrder: 20 },
};

test('a quote carries the delivery fee, and an older quote without one has none', () => {
  const delivery = parseQuote({ ...QUOTE, subtotal: 30000, deliveryFee: 10000, total: 40000 });
  assert.equal(delivery?.subtotal, 30000);
  assert.equal(delivery?.deliveryFee, 10000);
  assert.equal(delivery?.total, 40000);
  const older = parseQuote({ ...QUOTE, total: 30000 });
  assert.equal(older?.deliveryFee, 0);
  assert.equal(older?.subtotal, 30000);
});

const ORDER = {
  orderNumber: 'ENE-ABCD2345',
  state: 'awaiting_payment',
  paymentState: 'unpaid',
  currency: 'NGN',
  total: 40000,
  subtotal: 30000,
  createdAt: '2026-11-05T10:00:00.000Z',
  canPay: true,
  canCancel: true,
  expiresAt: null,
  paidAt: null,
  paymentReference: null,
  items: [{ slug: 'rice-combo', name: 'Rice Combo', quantity: 2, unitPrice: 15000, lineTotal: 30000 }],
  contact: { name: 'Test Buyer', phone: '+2348030000000', note: null },
  timeline: [],
};

test('an order carries how it is received: the address copy and fee for delivery, the store for pickup', () => {
  const delivery = parseCustomerOrder({
    ...ORDER,
    fulfilment: {
      method: 'delivery',
      deliveryFee: 10000,
      address: { recipientName: 'Ada Obi', recipientPhone: '+2348031234567', addressLine: '12 Admiralty Way', city: 'Lagos', secret: 'x' },
      pickup: null,
    },
  });
  assert.equal(delivery?.fulfilment.method, 'delivery');
  assert.equal(delivery?.fulfilment.deliveryFee, 10000);
  assert.equal(delivery?.fulfilment.address?.recipientName, 'Ada Obi');
  assert.equal(delivery?.fulfilment.address && 'secret' in delivery.fulfilment.address, false);

  const pickup = parseCustomerOrder({ ...ORDER, fulfilment: { method: 'pickup', deliveryFee: 0, address: null, pickup: { address: 'Our store', hours: '9am - 5pm' } } });
  assert.equal(pickup?.fulfilment.method, 'pickup');
  assert.deepEqual(pickup?.fulfilment.pickup, { address: 'Our store', hours: '9am - 5pm' });
});

test('an order from before delivery existed still parses, with no method', () => {
  const old = parseCustomerOrder(ORDER);
  assert.ok(old);
  assert.deepEqual(old.fulfilment, { method: null, deliveryFee: 0, address: null, pickup: null });
  assert.deepEqual(parseFulfilment({ method: 'drone' }), { method: null, deliveryFee: 0, address: null, pickup: null });
});

test('the address book is a valid place to return to after signing in', () => {
  assert.equal(safeNextPath('/account/addresses'), '/account/addresses');
  assert.equal(safeNextPath('/account/login'), '/my-orders');
  assert.equal(safeNextPath('/account/addressesx'), '/my-orders');
});
