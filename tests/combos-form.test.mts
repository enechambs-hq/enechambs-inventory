import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyComboForm,
  formFromCombo,
  hasChanges,
  isSlugFrozen,
  parseMoney,
  suggestSlug,
  validateCreate,
  validateUpdate,
  type ComboFormValues,
} from '../src/lib/combos/form.ts';
import { combo } from './combos-support.mts';

const valid = (over: Partial<ComboFormValues> = {}): ComboFormValues => ({
  ...emptyComboForm(),
  name: 'Festive Rice Combo',
  price: '25,000',
  referencePrice: '32000',
  totalQuantity: '50',
  ...over,
});

// ── create ────────────────────────────────────────────────────────────────────
test('create builds exactly the fields the backend accepts', () => {
  const r = validateCreate(valid({ description: '  A bundle  ', slug: ' festive-rice ' }));
  assert.ok(r.ok);
  assert.deepEqual(r.payload, {
    name: 'Festive Rice Combo',
    slug: 'festive-rice',
    description: 'A bundle',
    price: 25000,
    referencePrice: 32000,
    totalQuantity: 50,
  });
});

test('create never sends server-managed fields', () => {
  const r = validateCreate(valid());
  assert.ok(r.ok);
  for (const key of ['status', 'remainingQuantity', 'allocatedQuantity', 'id']) {
    assert.ok(!(key in r.payload), key);
  }
});

test('create omits blank optional fields (server generates the slug)', () => {
  const r = validateCreate(valid({ slug: '', description: '', referencePrice: '' }));
  assert.ok(r.ok);
  assert.deepEqual(r.payload, { name: 'Festive Rice Combo', price: 25000, totalQuantity: 50 });
});

test('create validation matches the backend DTO', () => {
  const cases: Array<[Partial<ComboFormValues>, string]> = [
    [{ name: 'A' }, 'name'],
    [{ name: 'x'.repeat(161) }, 'name'],
    [{ slug: 'ab' }, 'slug'],
    [{ slug: 'Has Caps' }, 'slug'],
    [{ slug: 'double--hyphen' }, 'slug'],
    [{ slug: '-leading' }, 'slug'],
    [{ price: '' }, 'price'],
    [{ price: '0' }, 'price'],
    [{ price: '0.001' }, 'price'],
    [{ price: '12.345' }, 'price'],
    [{ price: 'abc' }, 'price'],
    [{ price: '100000001' }, 'price'],
    [{ referencePrice: '1.234' }, 'referencePrice'],
    [{ referencePrice: '24999.99' }, 'referencePrice'], // below the promotional price
    [{ totalQuantity: '' }, 'totalQuantity'],
    [{ totalQuantity: '0' }, 'totalQuantity'], // create requires at least 1
    [{ totalQuantity: '2.5' }, 'totalQuantity'],
    [{ totalQuantity: '100001' }, 'totalQuantity'],
    [{ description: 'x'.repeat(5001) }, 'description'],
  ];
  for (const [over, field] of cases) {
    const r = validateCreate(valid(over));
    assert.ok(!r.ok, JSON.stringify(over));
    assert.ok(field in r.errors, `${JSON.stringify(over)} should flag ${field}`);
  }
});

test('boundary values the backend accepts are accepted', () => {
  assert.ok(validateCreate(valid({ price: '0.01', referencePrice: '0.01', totalQuantity: '1' })).ok);
  assert.ok(validateCreate(valid({ price: '100000000', referencePrice: '', totalQuantity: '100000' })).ok);
  assert.ok(validateCreate(valid({ name: 'ab', slug: 'abc' })).ok);
  assert.ok(validateCreate(valid({ referencePrice: '25000' })).ok); // equal to price is allowed
});

test('parseMoney handles commas, blanks and bad input', () => {
  assert.equal(parseMoney('1,234.50'), 1234.5);
  assert.equal(parseMoney('  '), null);
  assert.equal(parseMoney('1.234'), 'invalid');
  assert.equal(parseMoney('-5'), 'invalid');
});

// ── edit ──────────────────────────────────────────────────────────────────────
test('edit sends only what changed', () => {
  const c = combo();
  const r = validateUpdate({ ...formFromCombo(c), name: 'Renamed Combo', totalQuantity: '120' }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload, { name: 'Renamed Combo', totalQuantity: 120 });
});

test('edit with no changes produces an empty payload (no pointless PATCH)', () => {
  const c = combo();
  const r = validateUpdate(formFromCombo(c), c);
  assert.ok(r.ok);
  assert.equal(hasChanges(r.payload), false);
});

test('clearing the reference price sends null; the server removes it', () => {
  const c = combo();
  const r = validateUpdate({ ...formFromCombo(c), referencePrice: '' }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload, { referencePrice: null });
});

test('a published combo’s slug is frozen: read-only and never sent', () => {
  const c = combo({ status: 'published' });
  assert.equal(isSlugFrozen(c), true);
  const r = validateUpdate({ ...formFromCombo(c), slug: 'something-else', name: 'New Name' }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload, { name: 'New Name' });
});

test('draft and unpublished combos may change slug (backend freezes only while published)', () => {
  for (const status of ['draft', 'unpublished'] as const) {
    const c = combo({ status });
    assert.equal(isSlugFrozen(c), false);
    const r = validateUpdate({ ...formFromCombo(c), slug: 'new-slug' }, c);
    assert.ok(r.ok);
    assert.deepEqual(r.payload, { slug: 'new-slug' });
  }
});

test('edit allows a total of zero (the backend allows it) but not negatives or fractions', () => {
  const c = combo({ allocatedQuantity: 0, remainingQuantity: 100 });
  assert.ok(validateUpdate({ ...formFromCombo(c), totalQuantity: '0' }, c).ok);
  assert.ok(!validateUpdate({ ...formFromCombo(c), totalQuantity: '-1' }, c).ok);
  assert.ok(!validateUpdate({ ...formFromCombo(c), totalQuantity: '1.5' }, c).ok);
});

test('edit never sends remaining, allocated or status', () => {
  const c = combo();
  const r = validateUpdate(
    { ...formFromCombo(c), name: 'X Y', price: '1', referencePrice: '', totalQuantity: '5', slug: 'new-slug', description: 'd' },
    c,
  );
  assert.ok(r.ok);
  for (const key of ['status', 'remainingQuantity', 'allocatedQuantity', 'id', 'images']) {
    assert.ok(!(key in r.payload), key);
  }
});

test('edit does not blame the user for a stale reference price', () => {
  // price raised above the existing reference price in the same edit
  const c = combo({ price: 25000, referencePrice: 32000 });
  const r = validateUpdate({ ...formFromCombo(c), price: '40000' }, c);
  assert.ok(!r.ok);
  assert.ok('referencePrice' in r.errors);
});

test('suggestSlug follows the backend slug pattern', () => {
  assert.equal(suggestSlug('Festive Rice & Beans Combo!'), 'festive-rice-beans-combo');
  assert.equal(suggestSlug('  Crème Brûlée  '), 'creme-brulee');
});
