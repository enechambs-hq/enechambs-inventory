import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addLine, cartFingerprint, cartUnits, MAX_CART_LINES, MAX_LINE_QUANTITY, parseCart, removeLine, serializeCart, setLineQuantity, toRequestItems,
  type CartLine,
} from '../src/lib/storefront/cart.ts';
import { ATTEMPT_STORAGE_KEY, forgetAttempt, requestIdFor, type KeyValueStorage } from '../src/lib/storefront/checkout-attempt.ts';
import { isTrustedCheckoutUrl, loginHref, registerHref, safeNextPath } from '../src/lib/storefront/redirects.ts';

const line = (slug: string, quantity = 1, name = slug): CartLine => ({ slug, quantity, name });
const must = (r: ReturnType<typeof addLine>) => {
  assert.equal(r.ok, true);
  return (r as { ok: true; lines: CartLine[] }).lines;
};

// ── cart ──────────────────────────────────────────────────────────────────────
test('adding merges the same combo and keeps others', () => {
  let lines = must(addLine([], 'rice-combo', 'Rice Combo'));
  lines = must(addLine(lines, 'beans-combo', 'Beans'));
  lines = must(addLine(lines, 'rice-combo', 'Rice Combo', 2));
  assert.deepEqual(lines.map((l) => [l.slug, l.quantity]), [['rice-combo', 3], ['beans-combo', 1]]);
  assert.equal(cartUnits(lines), 4);
});

test('invalid slugs and quantities are refused; a full cart refuses new lines but still merges', () => {
  assert.deepEqual(addLine([], 'Bad Slug!', 'x'), { ok: false, reason: 'invalid' });
  assert.deepEqual(addLine([], '../etc', 'x'), { ok: false, reason: 'invalid' });
  assert.deepEqual(addLine([], 'ok', 'x', 0), { ok: false, reason: 'invalid' });
  assert.deepEqual(addLine([], 'ok', 'x', Number.NaN), { ok: false, reason: 'invalid' });
  const full = Array.from({ length: MAX_CART_LINES }, (_, i) => line(`combo-${i}`));
  assert.deepEqual(addLine(full, 'another', 'x'), { ok: false, reason: 'cart_full' });
  assert.equal(must(addLine(full, 'combo-3', 'x'))[3].quantity, 2);
});

test('quantity is capped and setting it to zero removes the line', () => {
  let lines = must(addLine([], 'a', 'A'));
  lines = setLineQuantity(lines, 'a', 999_999);
  assert.equal(lines[0].quantity, MAX_LINE_QUANTITY);
  assert.deepEqual(setLineQuantity(lines, 'a', 0), []);
  assert.deepEqual(setLineQuantity(lines, 'missing', 3), lines);
  assert.deepEqual(removeLine(lines, 'a'), []);
});

test('stored cart text is parsed defensively: junk is dropped, duplicates collapse, nothing throws', () => {
  assert.deepEqual(parseCart(null), []);
  assert.deepEqual(parseCart('not json'), []);
  assert.deepEqual(parseCart('{"lines":"nope"}'), []);
  const raw = JSON.stringify({
    v: 1,
    lines: [
      { slug: 'good', quantity: 2, name: 'Good' },
      { slug: 'good', quantity: 5, name: 'Dup' },
      { slug: 'Bad Slug', quantity: 1 },
      { slug: 'neg', quantity: -3 },
      { slug: 'nan', quantity: 'x' },
      { slug: 'big', quantity: 1e9, price: 1, extra: 'ignored' },
      null,
      7,
    ],
  });
  assert.deepEqual(parseCart(raw), [line('good', 2, 'Good'), { slug: 'big', quantity: MAX_LINE_QUANTITY, name: '' }]);
});

test('round trip, and the request carries only slug and quantity (never a price or name)', () => {
  const lines = [line('a', 2, 'A name'), line('b', 1)];
  assert.deepEqual(parseCart(serializeCart(lines)), lines);
  assert.deepEqual(toRequestItems(lines), [{ slug: 'a', quantity: 2 }, { slug: 'b', quantity: 1 }]);
  assert.ok(!JSON.stringify(toRequestItems(lines)).includes('A name'));
});

test('the cart module has no session, token or network code (signing in cannot touch it)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/lib/storefront/cart.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /fetch\(|cookie|token|session|localStorage|sessionStorage|window\./i);
});

test('the fingerprint ignores order and changes with contents', () => {
  assert.equal(cartFingerprint([line('a', 1), line('b', 2)]), cartFingerprint([line('b', 2), line('a', 1)]));
  assert.notEqual(cartFingerprint([line('a', 1)]), cartFingerprint([line('a', 2)]));
});

// ── idempotency key ───────────────────────────────────────────────────────────
function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}
const UUIDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];

test('the same cart reuses its key (retry / double click); a changed cart or a finished order gets a new one', () => {
  const store = memory();
  let n = 0;
  const gen = () => UUIDS[n++];
  const a = requestIdFor('a:1', store, gen);
  assert.equal(requestIdFor('a:1', store, gen), a);
  assert.equal(n, 1);
  const b = requestIdFor('a:2', store, gen);
  assert.notEqual(b, a);
  forgetAttempt(store);
  assert.equal(store.data.has(ATTEMPT_STORAGE_KEY), false);
  assert.notEqual(requestIdFor('a:2', store, gen), b);
});

test('a tampered stored key is ignored; broken storage still yields a key', () => {
  const store = memory();
  store.data.set(ATTEMPT_STORAGE_KEY, JSON.stringify({ fp: 'x', id: 'not-a-uuid' }));
  assert.equal(requestIdFor('x', store, () => UUIDS[0]), UUIDS[0]);
  store.data.set(ATTEMPT_STORAGE_KEY, '{bad json');
  assert.equal(requestIdFor('x', store, () => UUIDS[1]), UUIDS[1]);
  assert.equal(requestIdFor('x', null, () => UUIDS[2]), UUIDS[2]);
  const throwing: KeyValueStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  assert.equal(requestIdFor('x', throwing, () => UUIDS[0]), UUIDS[0]);
  assert.doesNotThrow(() => forgetAttempt(throwing));
});

// ── safe redirects ────────────────────────────────────────────────────────────
test('only same-site customer paths are honoured after sign-in', () => {
  for (const ok of ['/checkout', '/my-orders', '/my-orders/ENE-ABCD2345', '/cart', '/combos/festive-rice?x=1', '/checkout?step=2']) {
    assert.equal(safeNextPath(ok), ok, ok);
  }
  for (const bad of [
    'https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', '/login', '/dashboard', '/promotions/combos',
    '/checkoutx', '/my-ordersx', '', '/%2F%2Fevil.example', 'checkout', '/checkout\n', '/checkout\r\nSet-Cookie: x', '/' + 'a'.repeat(300),
  ]) {
    assert.equal(safeNextPath(bad), '/my-orders', JSON.stringify(bad));
  }
  assert.equal(safeNextPath(undefined, '/cart'), '/cart');
  assert.equal(safeNextPath(['/checkout', 'https://evil.example']), '/checkout');
});

test('login and register links carry only a validated next', () => {
  assert.equal(loginHref(), '/account/login');
  assert.equal(loginHref('/checkout'), '/account/login?next=%2Fcheckout');
  assert.equal(loginHref('https://evil.example'), '/account/login?next=%2Fmy-orders');
  assert.equal(registerHref('/checkout'), '/account/register?next=%2Fcheckout');
});

test('only an https Flutterwave checkout address is ever navigated to', () => {
  assert.equal(isTrustedCheckoutUrl('https://checkout.flutterwave.com/v3/hosted/pay/abc'), true);
  assert.equal(isTrustedCheckoutUrl('https://flutterwave.com/pay/x'), true);
  assert.equal(isTrustedCheckoutUrl('https://checkout-v2.dev-flutterwave.com/v3/hosted/pay/abc'), true);
  for (const bad of [
    'https://evildev-flutterwave.com/x', 'https://dev-flutterwave.com.evil.example/x',
    'http://checkout.flutterwave.com/x', 'https://evil.example/pay', 'https://flutterwave.com.evil.example/x', 'https://evilflutterwave.com/x',
    'javascript:alert(1)', '//checkout.flutterwave.com/x', 'https://flutterwave.com@evil.example/x', '', null, 42,
  ]) {
    assert.equal(isTrustedCheckoutUrl(bad as never), false, String(bad));
  }
});
