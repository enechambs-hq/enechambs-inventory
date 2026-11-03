import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  catalogueHref,
  catalogueQuery,
  formatNaira,
  isSoldOut,
  isValidSlug,
  parseComboList,
  parsePageParam,
  parsePublicCombo,
  parseSearchParam,
  savingOf,
} from '../src/lib/storefront/catalogue.ts';

const wire = (over: Record<string, unknown> = {}) => ({
  name: 'Festive Rice Combo',
  slug: 'festive-rice-combo',
  description: 'Rice and more',
  price: 25000,
  referencePrice: 32000,
  images: [{ url: 'https://media.example.test/combos/a.jpg', altText: 'Rice' }],
  availability: { status: 'available', label: 'Available' },
  ...over,
});

// ── query handling: only page, limit, q ───────────────────────────────────────
test('the API query carries only page, limit and q', () => {
  assert.equal(catalogueQuery({}), '?page=1&limit=12');
  assert.equal(catalogueQuery({ page: 3, limit: 4, q: ' jollof ' }), '?page=3&limit=4&q=jollof');
  const params = new URLSearchParams(catalogueQuery({ page: 2, q: 'a&status=draft' }));
  assert.deepEqual([...params.keys()].sort(), ['limit', 'page', 'q']);
  assert.equal(params.get('q'), 'a&status=draft'); // encoded as a value, never a second parameter
});

test('limit never exceeds the API maximum; bad pages fall back to 1', () => {
  assert.equal(new URLSearchParams(catalogueQuery({ limit: 500 })).get('limit'), '48');
  assert.equal(new URLSearchParams(catalogueQuery({ page: 0 })).get('page'), '1');
  assert.equal(new URLSearchParams(catalogueQuery({ page: -2 })).get('page'), '1');
});

test('?page= and ?q= from the address bar are sanitised', () => {
  assert.equal(parsePageParam('3'), 3);
  assert.equal(parsePageParam(['4', '5']), 4);
  for (const bad of [undefined, '', '0', '-1', 'abc', '1.5', '99999999', '1e3', ' 2']) assert.equal(parsePageParam(bad), 1, String(bad));
  assert.equal(parseSearchParam('  rice  '), 'rice');
  assert.equal(parseSearchParam(undefined), '');
  assert.equal(parseSearchParam('x'.repeat(300)).length, 100);
  assert.equal(parseSearchParam(['a', 'b']), 'a');
});

test('catalogue links keep the search, omit page 1 and empty searches', () => {
  assert.equal(catalogueHref({}), '/combos');
  assert.equal(catalogueHref({ page: 1 }), '/combos');
  assert.equal(catalogueHref({ page: 2 }), '/combos?page=2');
  assert.equal(catalogueHref({ q: 'rice', page: 3 }), '/combos?q=rice&page=3');
  assert.equal(catalogueHref({ q: 'a b&c' }), '/combos?q=a+b%26c');
});

test('slugs follow the backend rule', () => {
  for (const ok of ['festive-rice-combo', 'a', 'x1-y2']) assert.equal(isValidSlug(ok), true, ok);
  for (const bad of ['', 'Upper', 'a--b', '-a', 'a-', 'a b', 'a/b', '..', 'x'.repeat(121), "a'--"]) assert.equal(isValidSlug(bad), false, bad);
});

// ── money ─────────────────────────────────────────────────────────────────────
test('prices are shown in Naira', () => {
  assert.equal(formatNaira(25000), '₦25,000');
  assert.equal(formatNaira(1234.5), '₦1,234.5');
  assert.equal(formatNaira(0), '₦0');
  assert.equal(savingOf({ price: 25000, referencePrice: 32000 }), 7000);
  assert.equal(savingOf({ price: 25000, referencePrice: null }), null);
  assert.equal(savingOf({ price: 25000, referencePrice: 25000 }), null);
});

// ── real API fields render; nothing else comes through ───────────────────────
test('a public combo keeps exactly the public fields', () => {
  const combo = parsePublicCombo(wire());
  assert.deepEqual(combo, {
    name: 'Festive Rice Combo',
    slug: 'festive-rice-combo',
    description: 'Rice and more',
    price: 25000,
    referencePrice: 32000,
    images: [{ url: 'https://media.example.test/combos/a.jpg', altText: 'Rice' }],
    availability: { status: 'available', label: 'Available' },
  });
});

test('extra or internal fields on the wire are never carried through', () => {
  const combo = parsePublicCombo(
    wire({
      id: 'uuid', totalQuantity: 100, remainingQuantity: 7, allocatedQuantity: 3, status: 'published',
      createdAt: 'x', objectKey: 'combos/a.jpg',
      images: [{ url: 'https://media.example.test/a.jpg', altText: '', contentType: 'image/jpeg', sizeBytes: 1, objectKey: 'k' }],
    }),
  );
  assert.ok(combo);
  assert.deepEqual(Object.keys(combo).sort(), ['availability', 'description', 'images', 'name', 'price', 'referencePrice', 'slug']);
  assert.deepEqual(Object.keys(combo.images[0]).sort(), ['altText', 'url']);
});

test('availability: available, low stock (exact count) and sold out', () => {
  const available = parsePublicCombo(wire({ availability: { status: 'available', label: 'Available' } }));
  const low = parsePublicCombo(wire({ availability: { status: 'low_stock', label: 'Only 7 left', remaining: 7 } }));
  const out = parsePublicCombo(wire({ availability: { status: 'sold_out', label: 'Sold Out' } }));
  assert.deepEqual(available?.availability, { status: 'available', label: 'Available' });
  assert.deepEqual(low?.availability, { status: 'low_stock', label: 'Only 7 left', remaining: 7 });
  assert.deepEqual(out?.availability, { status: 'sold_out', label: 'Sold Out' });
  assert.equal(isSoldOut(out!), true);
  assert.equal(isSoldOut(available!), false);
});

test('an exact count is dropped unless the API says low stock (never shown for available items)', () => {
  const leaky = parsePublicCombo(wire({ availability: { status: 'available', label: 'Available', remaining: 480 } }));
  assert.equal('remaining' in leaky!.availability, false);
  const soldOut = parsePublicCombo(wire({ availability: { status: 'sold_out', label: 'Sold Out', remaining: 0 } }));
  assert.equal('remaining' in soldOut!.availability, false);
});

test('an unknown status or a missing label is handled, not trusted', () => {
  assert.equal(parsePublicCombo(wire({ availability: { status: 'plenty', label: 'x' } })), null);
  assert.equal(parsePublicCombo(wire({ availability: null })), null);
  assert.equal(parsePublicCombo(wire({ availability: { status: 'sold_out' } }))?.availability.label, 'Sold Out');
});

test('missing images: an empty list is fine, and unusable URLs are dropped (placeholder shown)', () => {
  assert.deepEqual(parsePublicCombo(wire({ images: [] }))?.images, []);
  assert.deepEqual(parsePublicCombo(wire({ images: undefined }))?.images, []);
  const mixed = parsePublicCombo(
    wire({
      images: [
        { url: 'http://insecure.example.test/a.jpg', altText: '' },
        { url: '/relative/a.jpg', altText: '' },
        { url: 'javascript:alert(1)', altText: '' },
        { url: 'not a url', altText: '' },
        { url: null, altText: '' },
        { url: 'https://media.example.test/ok.jpg', altText: 'ok' },
      ],
    }),
  );
  assert.deepEqual(mixed?.images, [{ url: 'https://media.example.test/ok.jpg', altText: 'ok' }]);
});

test('invalid records are rejected', () => {
  for (const bad of [null, [], 'x', {}, wire({ name: '' }), wire({ slug: 'Bad Slug' }), wire({ price: '25000' }), wire({ price: -1 }), wire({ price: NaN })]) {
    assert.equal(parsePublicCombo(bad), null);
  }
  assert.equal(parsePublicCombo(wire({ referencePrice: 'x' }))?.referencePrice, null);
  assert.equal(parsePublicCombo(wire({ referencePrice: 0 }))?.referencePrice, null);
});

test('a list keeps valid combos, skips invalid ones, and requires numeric meta', () => {
  const list = parseComboList({
    data: [wire(), wire({ slug: 'BAD' }), wire({ slug: 'second', name: 'Second' })],
    meta: { total: 3, page: 1, limit: 12, totalPages: 1 },
  });
  assert.deepEqual(list?.data.map((c) => c.slug), ['festive-rice-combo', 'second']);
  assert.deepEqual(list?.meta, { total: 3, page: 1, limit: 12, totalPages: 1 });
  assert.equal(parseComboList({ data: [], meta: { total: 'x', page: 1, limit: 12, totalPages: 1 } }), null);
  assert.equal(parseComboList({ data: 'no', meta: {} }), null);
  assert.equal(parseComboList(null), null);
  assert.deepEqual(parseComboList({ data: [], meta: { total: 0, page: 1, limit: 12, totalPages: 0 } })?.data, []);
});
