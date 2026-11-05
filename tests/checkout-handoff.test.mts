import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HANDOFF_STORAGE_KEY, rememberHandoff, takeHandoff, type KeyValueStorage } from '../src/lib/storefront/checkout-attempt.ts';

function memory(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

test('a remembered order number is returned once and then forgotten', () => {
  const storage = memory();
  rememberHandoff(storage, 'ENE-MPUE3RUT');
  assert.equal(takeHandoff(storage), 'ENE-MPUE3RUT');
  assert.equal(takeHandoff(storage), null);
  assert.equal(HANDOFF_STORAGE_KEY in storage.data, false);
});

test('anything that is not an order number is refused, and still forgotten', () => {
  for (const bad of ['', 'ene-mpue3rut', 'ENE-', 'ENE-AB', '/my-orders/../x', 'https://evil.example', 'ENE-MPUE3RUT/../../x', 'x'.repeat(100)]) {
    const storage = memory({ [HANDOFF_STORAGE_KEY]: bad });
    assert.equal(takeHandoff(storage), null, bad);
    assert.equal(HANDOFF_STORAGE_KEY in storage.data, false, `${bad} is cleared`);
  }
});

test('without storage, or when storage throws, nothing breaks', () => {
  assert.doesNotThrow(() => rememberHandoff(null, 'ENE-MPUE3RUT'));
  assert.equal(takeHandoff(null), null);
  const broken: KeyValueStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  assert.doesNotThrow(() => rememberHandoff(broken, 'ENE-MPUE3RUT'));
  assert.equal(takeHandoff(broken), null);
});
