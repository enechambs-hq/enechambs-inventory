'use client';

import { useEffect, useState } from 'react';
import { toRequestItems, type CartLine } from '@/lib/storefront/cart';
import { parseQuote, type FulfilmentMethod, type Quote } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import type { AppError } from '@/lib/errors/app-error';

export type QuoteState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; quote: Quote }
  | { status: 'error'; message: string; error: AppError };

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
      // A quote is a price check that changes nothing, so asking again is safe (idempotent) even though it is a POST.
      setState(r.ok ? { status: 'ready', quote: r.data } : { status: 'error', message: friendlyMessage(r), error: appErrorFromStore(r, { method: 'POST', idempotent: true, what: 'your cart' }) });
    });
    return () => controller.abort();
    // `key` stands for `lines`: re-ask only when contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, attempt, method]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
