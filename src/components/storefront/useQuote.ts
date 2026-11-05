'use client';

import { useEffect, useState } from 'react';
import { toRequestItems, type CartLine } from '@/lib/storefront/cart';
import { parseQuote, type FulfilmentMethod, type Quote } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';

export type QuoteState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; quote: Quote }
  | { status: 'error'; message: string };

/**
 * The server's authoritative view of the cart (price, availability, limits).
 * Nothing is allocated by asking. Re-asked whenever the cart or the delivery
 * choice changes (delivery adds the delivery fee to the total).
 */
export function useQuote(lines: CartLine[], hydrated: boolean, method: FulfilmentMethod = 'pickup'): QuoteState & { retry: () => void } {
  const [state, setState] = useState<QuoteState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = lines.map((l) => `${l.slug}:${l.quantity}`).join('|');

  useEffect(() => {
    if (!hydrated) return;
    if (lines.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    const controller = new AbortController();
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    storeRequest({
      path: 'storefront/cart/quote',
      method: 'POST',
      body: { items: toRequestItems(lines), fulfilment: { method } },
      parse: parseQuote,
      signal: controller.signal,
    }).then((r) => {
      if (controller.signal.aborted) return;
      setState(r.ok ? { status: 'ready', quote: r.data } : { status: 'error', message: friendlyMessage(r) });
    });
    return () => controller.abort();
    // `key` stands for `lines`: re-ask only when contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, attempt, method]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
