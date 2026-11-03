import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addItemRow,
  emptyComboForm,
  formFromCombo,
  hasChanges,
  isSlugFrozen,
  newItemRow,
  parseMoney,
  removeItemRow,
  suggestSlug,
  updateItemRow,
  validateCreate,
  validateUpdate,
  type ComboFormValues,
} from '../src/lib/combos/form.ts';
import { combo } from './combos-support.mts';

const valid = (over: Partial<ComboFormValues> = {}): ComboFormValues => ({
  ...emptyComboForm(),
  name: 'Festive Rice Combo',
  items: [newItemRow('Rice', '1 kg')],
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
    items: [{ name: 'Rice', quantityLabel: '1 kg' }],
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
  assert.deepEqual(r.payload, {
    name: 'Festive Rice Combo',
    items: [{ name: 'Rice', quantityLabel: '1 kg' }],
    price: 25000,
    totalQuantity: 50,
  });
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

// ── "What's included in this combo?" ─────────────────────────────────────────
const rows = (...pairs: Array<[string, string]>) => pairs.map(([n, q]) => newItemRow(n, q));

test('a new form starts with exactly one empty item row', () => {
  const form = emptyComboForm();
  assert.equal(form.items.length, 1);
  assert.equal(form.items[0].name, '');
  assert.equal(form.items[0].quantityLabel, '');
});

test('two new forms never share row keys, and keys are unique within a form', () => {
  const a = emptyComboForm();
  const b = emptyComboForm();
  assert.notEqual(a.items[0].key, b.items[0].key);
  const many = addItemRow(addItemRow(a.items));
  assert.equal(new Set(many.map((r) => r.key)).size, 3);
});

test('adding a row appends a blank one and leaves existing rows and their text untouched', () => {
  const before = rows(['Rice', '1 kg'], ['Beans', '2 kg']);
  const after = addItemRow(before);
  assert.equal(after.length, 3);
  assert.deepEqual(after.slice(0, 2), before);
  assert.deepEqual([after[2].name, after[2].quantityLabel], ['', '']);
});

test('adding stops at the 50-item limit', () => {
  let list = emptyComboForm().items;
  for (let i = 0; i < 80; i++) list = addItemRow(list);
  assert.equal(list.length, 50);
});

test('removing a row keeps every other row, its text and the order', () => {
  const [rice, beans, oil, garri] = rows(['Rice', '1 kg'], ['Beans', '2 kg'], ['Palm oil', '1 litre'], ['Garri', '']);
  const after = removeItemRow([rice, beans, oil, garri], beans.key);
  assert.deepEqual(after, [rice, oil, garri]);
  assert.deepEqual(after.map((r) => r.key), [rice.key, oil.key, garri.key]);
});

test('removing the only row leaves one fresh blank row (the form never shows zero rows)', () => {
  const [only] = rows(['Rice', '1 kg']);
  const after = removeItemRow([only], only.key);
  assert.equal(after.length, 1);
  assert.notEqual(after[0].key, only.key);
  assert.deepEqual([after[0].name, after[0].quantityLabel], ['', '']);
});

test('editing one row changes only that row; add and remove afterwards keep the edit', () => {
  const start = rows(['Rice', ''], ['Beans', '']);
  const edited = updateItemRow(start, start[1].key, { quantityLabel: '2 kg' });
  assert.deepEqual(edited[0], start[0]);
  assert.equal(edited[1].quantityLabel, '2 kg');
  const grown = addItemRow(edited);
  const shrunk = removeItemRow(grown, grown[2].key);
  assert.deepEqual(shrunk, edited);
});

test('create sends items trimmed, in the order entered, as exactly { name, quantityLabel }', () => {
  const r = validateCreate(
    valid({
      items: rows(['  Rice ', ' 1 kg '], ['Beans', '2 kg'], ['Palm oil', '1 litre'], ['Garri', '']),
    }),
  );
  assert.ok(r.ok);
  assert.deepEqual(r.payload.items, [
    { name: 'Rice', quantityLabel: '1 kg' },
    { name: 'Beans', quantityLabel: '2 kg' },
    { name: 'Palm oil', quantityLabel: '1 litre' },
    { name: 'Garri', quantityLabel: null },
  ]);
  for (const item of r.payload.items) assert.deepEqual(Object.keys(item).sort(), ['name', 'quantityLabel']);
});

test('the quantity is optional: blank and whitespace-only become null', () => {
  const r = validateCreate(valid({ items: rows(['Garri', ''], ['Salt', '   ']) }));
  assert.ok(r.ok);
  assert.deepEqual(r.payload.items, [
    { name: 'Garri', quantityLabel: null },
    { name: 'Salt', quantityLabel: null },
  ]);
});

test('a blank item name is an error on that row, with a helpful message', () => {
  const items = rows(['Rice', '1 kg'], ['', '2 kg']);
  const r = validateCreate(valid({ items }));
  assert.ok(!r.ok);
  assert.equal(r.errors.itemRows?.[items[1].key]?.name, 'Enter the item name, or remove this row');
  assert.equal(r.errors.itemRows?.[items[0].key], undefined);
});

test('whitespace-only names are blank, and a completely empty row is not silently dropped', () => {
  for (const items of [rows(['   ', '']), rows(['Rice', '1 kg'], ['', ''])]) {
    const r = validateCreate(valid({ items }));
    assert.ok(!r.ok);
    assert.ok(Object.values(r.errors.itemRows ?? {}).some((e) => e.name));
  }
});

test('the untouched initial row blocks saving until it is filled in (at least one item required)', () => {
  const r = validateCreate({ ...valid(), items: emptyComboForm().items });
  assert.ok(!r.ok);
  assert.ok(r.errors.itemRows && Object.keys(r.errors.itemRows).length === 1);
});

test('a list with no rows at all is rejected as a whole', () => {
  const r = validateCreate(valid({ items: [] }));
  assert.ok(!r.ok);
  assert.equal(r.errors.items, 'Add at least one item to the combo');
});

test('item length limits match the backend: name 100, quantity 60, 50 items', () => {
  const edge = validateCreate(valid({ items: rows(['n'.repeat(100), 'q'.repeat(60)]) }));
  assert.ok(edge.ok);

  const longName = validateCreate(valid({ items: rows(['n'.repeat(101), '']) }));
  assert.ok(!longName.ok);
  assert.match(Object.values(longName.errors.itemRows ?? {})[0].name ?? '', /100 characters/);

  const longQty = validateCreate(valid({ items: rows(['Rice', 'q'.repeat(61)]) }));
  assert.ok(!longQty.ok);
  assert.match(Object.values(longQty.errors.itemRows ?? {})[0].quantityLabel ?? '', /60 characters/);

  const fifty = validateCreate(valid({ items: Array.from({ length: 50 }, (_, i) => newItemRow(`Item ${i}`, '')) }));
  assert.ok(fifty.ok);
  const fiftyOne = validateCreate(valid({ items: Array.from({ length: 51 }, (_, i) => newItemRow(`Item ${i}`, '')) }));
  assert.ok(!fiftyOne.ok);
  assert.match(fiftyOne.errors.items ?? '', /at most 50/);
});

test('item errors are reported together with other field errors', () => {
  const r = validateCreate(valid({ name: 'A', items: rows(['', '']) }));
  assert.ok(!r.ok);
  assert.ok(r.errors.name);
  assert.ok(r.errors.itemRows);
});

test('the payload never carries row keys or anything beyond name and quantityLabel', () => {
  const r = validateCreate(valid());
  assert.ok(r.ok);
  assert.ok(!JSON.stringify(r.payload).includes('item-'));
  assert.ok(!JSON.stringify(r.payload).includes('"key"'));
});

// ── editing contents ─────────────────────────────────────────────────────────
test('editing loads the saved items in order, with a missing quantity shown as blank', () => {
  const form = formFromCombo(combo());
  assert.deepEqual(
    form.items.map((r) => [r.name, r.quantityLabel]),
    [['Rice', '1 kg'], ['Beans', '2 kg'], ['Garri', '']],
  );
});

test('edit with unchanged items does not send items', () => {
  const c = combo();
  const r = validateUpdate({ ...formFromCombo(c), name: 'Renamed Combo' }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload, { name: 'Renamed Combo' });
});

test('edit sends the whole new list when any item changes', () => {
  const c = combo();
  const form = formFromCombo(c);
  const changed = updateItemRow(form.items, form.items[1].key, { quantityLabel: '3 kg' });
  const r = validateUpdate({ ...form, items: changed }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload, {
    items: [
      { name: 'Rice', quantityLabel: '1 kg' },
      { name: 'Beans', quantityLabel: '3 kg' },
      { name: 'Garri', quantityLabel: null },
    ],
  });
});

test('edit treats a pure reordering as a change and keeps the new order', () => {
  const c = combo();
  const form = formFromCombo(c);
  const reordered = [form.items[2], form.items[0], form.items[1]];
  const r = validateUpdate({ ...form, items: reordered }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload.items?.map((i) => i.name), ['Garri', 'Rice', 'Beans']);
});

test('edit can add and remove items, and clear a quantity (sent as null)', () => {
  const c = combo();
  const form = formFromCombo(c);
  const withNew = addItemRow(form.items);
  const filled = updateItemRow(withNew, withNew[3].key, { name: 'Palm oil', quantityLabel: '1 litre' });
  const cleared = updateItemRow(filled, filled[0].key, { quantityLabel: '' });
  const noBeans = removeItemRow(cleared, cleared[1].key);
  const r = validateUpdate({ ...form, items: noBeans }, c);
  assert.ok(r.ok);
  assert.deepEqual(r.payload.items, [
    { name: 'Rice', quantityLabel: null },
    { name: 'Garri', quantityLabel: null },
    { name: 'Palm oil', quantityLabel: '1 litre' },
  ]);
});

test('edit rejects a blank item name and sends nothing', () => {
  const c = combo();
  const form = formFromCombo(c);
  const r = validateUpdate({ ...form, items: updateItemRow(form.items, form.items[0].key, { name: '  ' }) }, c);
  assert.ok(!r.ok);
  assert.ok(r.errors.itemRows?.[form.items[0].key]?.name);
});

test('a combo created before contents existed opens with one blank row and needs it filled to save', () => {
  const legacy = combo({ items: [] });
  const form = formFromCombo(legacy);
  assert.equal(form.items.length, 1);
  assert.equal(form.items[0].name, '');
  const blocked = validateUpdate({ ...form, name: 'Renamed Combo' }, legacy);
  assert.ok(!blocked.ok);
  const filled = validateUpdate({ ...form, items: [newItemRow('Rice', '')] }, legacy);
  assert.ok(filled.ok);
  assert.deepEqual(filled.payload, { items: [{ name: 'Rice', quantityLabel: null }] });
});
