'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import { formatNaira } from '@/lib/storefront/catalogue';
import { issueMessage, quoteIsPurchasable } from '@/lib/storefront/orders';
import { btnPrimary, btnSecondary, Card, Notice, Spinner } from './ui';
import { useHydrated } from './useHydrated';
import { useQuote } from './useQuote';

export default function CartView() {
  const lines = useCart();
  const hydrated = useHydrated();
  const quote = useQuote(lines, hydrated);

  if (!hydrated || quote.status === 'loading') return <Spinner label="Loading your cart" />;

  if (quote.status === 'empty') {
    return (
      <Card className="text-center">
        <p className="text-[#5d5645]">Your cart is empty.</p>
        <Link href="/combos" className={`${btnPrimary} mt-4`}>
          Browse combos
        </Link>
      </Card>
    );
  }

  if (quote.status === 'error') {
    return (
      <div className="space-y-4">
        <Notice tone="error">{quote.message}</Notice>
        <button type="button" className={btnSecondary} onClick={quote.retry}>
          Try again
        </button>
      </div>
    );
  }

  const q = quote.quote;
  const byslug = new Map(q.lines.map((l) => [l.slug, l]));
  const canCheckout = quoteIsPurchasable(q);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      <ul className="space-y-3" aria-label="Cart items">
        {lines.map((line) => {
          const priced = byslug.get(line.slug);
          const problem = priced && !priced.purchasable ? issueMessage(priced.issue, q.limits) : '';
          const name = priced?.name ?? line.name ?? line.slug;
          return (
            <li key={line.slug}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/combos/${line.slug}`} className="font-bold text-[#0f4f2d] hover:underline">
                      {name || line.slug}
                    </Link>
                    {priced?.unitPrice != null && <p className="mt-0.5 text-sm text-[#5d5645]">{formatNaira(priced.unitPrice)} each</p>}
                    {problem && (
                      <p role="alert" className="mt-1 text-sm font-medium text-[#8a2a1d]">
                        {problem}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold text-[#0f4f2d]">{priced?.lineTotal != null ? formatNaira(priced.lineTotal) : '—'}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full border border-[#d9ccaf]">
                    <button type="button" aria-label={`Decrease quantity of ${name}`} className="p-2.5 hover:bg-[#f6efe0] rounded-l-full" onClick={() => cartActions.setQuantity(line.slug, line.quantity - 1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite" data-testid={`qty-${line.slug}`}>
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${name}`}
                      disabled={line.quantity >= q.limits.maxPerLine}
                      className="p-2.5 hover:bg-[#f6efe0] rounded-r-full disabled:opacity-40"
                      onClick={() => cartActions.setQuantity(line.slug, line.quantity + 1)}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8a2a1d] hover:underline" onClick={() => cartActions.remove(line.slug)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <aside>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b7f6b]">Summary</h2>
          <dl className="mt-3 flex items-baseline justify-between">
            <dt className="text-[#3b3a33]">Total</dt>
            <dd className="text-2xl font-extrabold text-[#0f4f2d]" data-testid="cart-total">
              {formatNaira(q.total)}
            </dd>
          </dl>
          <p className="mt-1 text-xs text-[#8b7f6b]">Prices are confirmed by us at checkout. At most {q.limits.maxPerOrder} items per order.</p>
          {!q.withinOrderLimit && <div className="mt-3"><Notice tone="warn">Your cart is over the {q.limits.maxPerOrder}-item limit for one order. Please reduce it.</Notice></div>}
          {canCheckout ? (
            <Link href="/checkout" className={`${btnPrimary} mt-4 w-full`}>
              Checkout
            </Link>
          ) : (
            <button type="button" disabled className={`${btnPrimary} mt-4 w-full`}>
              Checkout
            </button>
          )}
          {!canCheckout && <p className="mt-2 text-xs text-[#8a2a1d]">Fix the highlighted items to continue.</p>}
          <button type="button" className="mt-3 w-full text-center text-sm text-[#5d5645] hover:underline" onClick={() => cartActions.clear()}>
            Empty cart
          </button>
        </Card>
      </aside>
    </div>
  );
}
