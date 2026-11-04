'use client';

/**
 * Browser cart store: localStorage + useSyncExternalStore. Components subscribe
 * with `useCart()`. Server render and hydration both see an empty cart (the
 * server snapshot), then the stored cart appears after mount, so there is no
 * hydration mismatch. Changes in another tab arrive through the `storage` event.
 *
 * Nothing here touches the customer session: signing in or out never reads,
 * merges or clears the cart.
 */
import { useSyncExternalStore } from 'react';
import {
  addLine,
  CART_STORAGE_KEY,
  parseCart,
  removeLine,
  serializeCart,
  setLineQuantity,
  type CartChange,
  type CartLine,
} from './cart.ts';

const EMPTY: CartLine[] = [];
let cache: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function snapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, lines: raw ? parseCart(raw) : EMPTY };
  return cache.lines;
}

function write(lines: CartLine[]): void {
  try {
    if (lines.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
    else window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
  } catch {
    /* storage unavailable: keep an in-memory copy so the page still works */
    cache = { raw: serializeCart(lines), lines };
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CART_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const cartActions = {
  add: (slug: string, name: string, quantity = 1): CartChange => {
    const result = addLine(snapshot(), slug, name, quantity);
    if (result.ok) write(result.lines);
    return result;
  },
  setQuantity: (slug: string, quantity: number): void => write(setLineQuantity(snapshot(), slug, quantity)),
  remove: (slug: string): void => write(removeLine(snapshot(), slug)),
  clear: (): void => write(EMPTY),
};

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
