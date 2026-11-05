/**
 * One idempotency key (`requestId`) per checkout attempt. The key is remembered
 * for the cart contents it was created for, so a double-click, a retry after a
 * dropped connection, or a page reload sends the SAME key and the API returns
 * the same order instead of creating (and charging stock for) a second one.
 * Changing the cart produces a new fingerprint and therefore a new key.
 *
 * Storage is injected (sessionStorage in the browser) so this is testable.
 */
export const ATTEMPT_STORAGE_KEY = 'ene_checkout_attempt_v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newRequestId(random: () => string = () => crypto.randomUUID()): string {
  return random();
}

export function requestIdFor(fingerprint: string, storage: KeyValueStorage | null, generate: () => string = newRequestId): string {
  if (storage) {
    try {
      const saved = JSON.parse(storage.getItem(ATTEMPT_STORAGE_KEY) ?? 'null') as { fp?: unknown; id?: unknown } | null;
      if (saved && saved.fp === fingerprint && typeof saved.id === 'string' && UUID_V4.test(saved.id)) return saved.id;
    } catch {
      /* fall through to a fresh key */
    }
  }
  const id = generate();
  if (storage) {
    try {
      storage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify({ fp: fingerprint, id }));
    } catch {
      /* private mode etc.: the key still works for this attempt */
    }
  }
  return id;
}

/** Called once the order exists: the next purchase must not reuse the key. */
export function forgetAttempt(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
