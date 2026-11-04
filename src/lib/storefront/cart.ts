/**
 * The guest cart: pure functions, no browser APIs (those live in cart-store.ts).
 *
 * The cart is a list of {slug, quantity} kept in the visitor's own browser. It
 * is NOT tied to the customer session: signing in, registering or signing out
 * never reads or clears it, so a guest's cart is still there afterwards. The
 * only thing that empties it is a successfully created order.
 *
 * Nothing stored here is trusted. The `name` is a display hint; price,
 * availability and limits always come from the server (`cart/quote`), and the
 * server prices the order itself. Relative imports only (node:test loads this).
 */
import { isValidSlug } from './catalogue.ts';

export const CART_STORAGE_KEY = 'ene_cart_v1';
/** The API accepts at most 25 lines per request. */
export const MAX_CART_LINES = 25;
/** Absolute client ceiling; the real per-line limit comes from the server's quote. */
export const MAX_LINE_QUANTITY = 1000;

export interface CartLine {
  slug: string;
  quantity: number;
  /** Display hint only. */
  name: string;
}

const clampQuantity = (n: number): number => Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(n)));

function validLine(value: unknown): CartLine | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.slug !== 'string' || !isValidSlug(v.slug)) return null;
  if (typeof v.quantity !== 'number' || !Number.isFinite(v.quantity) || v.quantity < 1) return null;
  const name = typeof v.name === 'string' ? v.name.slice(0, 120) : '';
  return { slug: v.slug, quantity: clampQuantity(v.quantity), name };
}

/** Reads stored cart text defensively: anything malformed is dropped, never thrown. */
export function parseCart(raw: string | null | undefined): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : (data as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const lines: CartLine[] = [];
  for (const item of list) {
    const line = validLine(item);
    if (!line || seen.has(line.slug)) continue;
    seen.add(line.slug);
    lines.push(line);
    if (lines.length >= MAX_CART_LINES) break;
  }
  return lines;
}

export const serializeCart = (lines: CartLine[]): string => JSON.stringify({ v: 1, lines });

export type CartChange = { ok: true; lines: CartLine[] } | { ok: false; reason: 'cart_full' | 'invalid' };

/** Adds `quantity` of a combo, merging with an existing line. */
export function addLine(lines: CartLine[], slug: string, name: string, quantity = 1): CartChange {
  if (!isValidSlug(slug) || !Number.isFinite(quantity) || quantity < 1) return { ok: false, reason: 'invalid' };
  const existing = lines.find((l) => l.slug === slug);
  if (existing) {
    return {
      ok: true,
      lines: lines.map((l) => (l.slug === slug ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l)),
    };
  }
  if (lines.length >= MAX_CART_LINES) return { ok: false, reason: 'cart_full' };
  return { ok: true, lines: [...lines, { slug, name: name.slice(0, 120), quantity: clampQuantity(quantity) }] };
}

/** Sets a line's quantity; zero or less removes it. Unknown slugs change nothing. */
export function setLineQuantity(lines: CartLine[], slug: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity) || quantity < 1) return removeLine(lines, slug);
  return lines.map((l) => (l.slug === slug ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export const removeLine = (lines: CartLine[], slug: string): CartLine[] => lines.filter((l) => l.slug !== slug);

export const cartUnits = (lines: CartLine[]): number => lines.reduce((sum, l) => sum + l.quantity, 0);

/** What the quote / order endpoints accept: slug and quantity, nothing else. */
export const toRequestItems = (lines: CartLine[]): Array<{ slug: string; quantity: number }> =>
  lines.map(({ slug, quantity }) => ({ slug, quantity }));

/**
 * A stable fingerprint of the cart contents. A checkout attempt keeps one
 * idempotency key per fingerprint, so retrying the same cart returns the same
 * order, while a changed cart starts a fresh attempt.
 */
export function cartFingerprint(lines: CartLine[]): string {
  return [...lines]
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((l) => `${l.slug}:${l.quantity}`)
    .join('|');
}
