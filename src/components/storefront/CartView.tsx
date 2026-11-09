'use client';

import Link from 'next/link';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import { cartUnits } from '@/lib/storefront/cart';
import { formatNaira } from '@/lib/storefront/catalogue';
import { issueMessage, quoteIsPurchasable } from '@/lib/storefront/orders';
import { btnPrimary, btnSecondary, Notice, Spinner } from './ui';
import { useHydrated } from './useHydrated';
import { useMediaQuery } from './useMediaQuery';
import { useQuote } from './useQuote';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const checkoutButton = `inline-flex min-h-12 items-center justify-center rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const stepButton = `inline-flex h-11 w-11 items-center justify-center hover:bg-[#f6efe0] disabled:opacity-40 ${focus}`;
const quietButton = `inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm text-[#5d5645] hover:underline ${focus}`;

export default function CartView() {
  const lines = useCart();
  const hydrated = useHydrated();
  const quote = useQuote(lines, hydrated);
  // Phones get a checkout bar instead of the summary card. Only one of them is
  // ever rendered, so the total and the Checkout action exist once on the page.
  const phone = useMediaQuery('(max-width: 639px)');

  const units = cartUnits(lines);
  const heading = (
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Your cart</h1>
      {hydrated && units > 0 && (
        <p className="mt-1 text-base text-[#5d5645]" data-testid="cart-item-count">
          {units} {units === 1 ? 'item' : 'items'}
        </p>
      )}
    </header>
  );

  if (!hydrated || quote.status === 'loading') {
    return (
      <>
        {heading}
        <Spinner label="Loading your cart" />
      </>
    );
  }

  if (quote.status === 'empty') {
    return (
      <>
        {heading}
        <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-[#eadfc8] bg-white/70 px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6efe0] text-[#1a7a4a]">
            <ShoppingBag size={26} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#1d2a22]">Your cart is empty.</h2>
          <p className="mt-2 text-base text-[#5d5645]">Add a combo to get started.</p>
          <Link href="/combos" className={`${btnPrimary} mt-5`}>
            Browse combos
          </Link>
        </div>
      </>
    );
  }

  if (quote.status === 'error') {
    return (
      <>
        {heading}
        <LoadErrorPanel error={quote.error} onRetry={quote.retry} title="We could not check your cart" actions={<Link href="/combos" className={btnSecondary}>Browse combos</Link>} />
      </>
    );
  }

  const q = quote.quote;
  const byslug = new Map(q.lines.map((l) => [l.slug, l]));
  const canCheckout = quoteIsPurchasable(q);

  const note = (
    <p className="text-sm text-[#5d5645]">Prices are confirmed by us at checkout. At most {q.limits.maxPerOrder} items per order.</p>
  );
  const limitNotice = !q.withinOrderLimit && (
    <div className="mt-3">
      <Notice tone="warn">Your cart is over the {q.limits.maxPerOrder}-item limit for one order. Please reduce it.</Notice>
    </div>
  );
  const fixMessage = !canCheckout && <p className="mt-2 text-sm text-[#8a2a1d]">Fix the highlighted items to continue.</p>;
  const nextStep = <p className="mt-3 text-center text-sm text-[#5d5645]">Next: choose delivery or pickup, then pay.</p>;
  const emptyCart = (
    <button type="button" className={`${quietButton} w-full`} onClick={() => cartActions.clear()}>
      Empty cart
    </button>
  );
  const checkout = canCheckout ? (
    <Link href="/checkout" className={checkoutButton}>
      Checkout
    </Link>
  ) : (
    <button type="button" disabled className={checkoutButton}>
      Checkout
    </button>
  );

  return (
    <>
      {heading}
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
        <div>
          <ul className="space-y-3 sm:space-y-4" aria-label="Cart items">
            {lines.map((line) => {
              const priced = byslug.get(line.slug);
              const problem = priced && !priced.purchasable ? issueMessage(priced.issue, q.limits) : '';
              const name = priced?.name ?? line.name ?? line.slug;
              return (
                <li key={line.slug}>
                  <div className="rounded-2xl border border-[#eadfc8] bg-white p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/combos/${line.slug}`} className="text-base font-semibold text-[#0f4f2d] hover:underline">
                          {name || line.slug}
                        </Link>
                        {priced?.unitPrice != null && <p className="mt-0.5 text-sm text-[#5d5645]">{formatNaira(priced.unitPrice)} each</p>}
                        {problem && (
                          <p role="alert" className="mt-1 text-sm font-medium text-[#8a2a1d]">
                            {problem}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-base font-bold text-[#0f4f2d]">{priced?.lineTotal != null ? formatNaira(priced.lineTotal) : '—'}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="inline-flex h-11 items-center rounded-full border border-[#d9ccaf]">
                        <button type="button" aria-label={`Decrease quantity of ${name}`} className={`${stepButton} rounded-l-full`} onClick={() => cartActions.setQuantity(line.slug, line.quantity - 1)}>
                          <Minus size={16} aria-hidden="true" />
                        </button>
                        <span className="min-w-10 text-center text-base font-semibold" aria-live="polite" data-testid={`qty-${line.slug}`}>
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${name}`}
                          disabled={line.quantity >= q.limits.maxPerLine}
                          className={`${stepButton} rounded-r-full`}
                          onClick={() => cartActions.setQuantity(line.slug, line.quantity + 1)}
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <button type="button" className={`-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-[#8a2a1d] hover:underline ${focus}`} onClick={() => cartActions.remove(line.slug)}>
                        <Trash2 size={16} aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {phone && (
            <div className="mt-5">
              {note}
              {limitNotice}
              {fixMessage}
              {nextStep}
              <div className="mt-1">{emptyCart}</div>
            </div>
          )}
        </div>

        {!phone && (
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[#eadfc8] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#0f4f2d]">Order summary</h2>
              <dl className="mt-3 flex items-baseline justify-between">
                <dt className="text-base text-[#3b3a33]">Total</dt>
                <dd className="text-2xl font-bold text-[#0f4f2d]" data-testid="cart-total">
                  {formatNaira(q.total)}
                </dd>
              </dl>
              <div className="mt-2">{note}</div>
              {limitNotice}
              <div className="mt-4 flex flex-col">{checkout}</div>
              {fixMessage}
              {nextStep}
              <div className="mt-1">{emptyCart}</div>
            </div>
          </aside>
        )}
      </div>

      {phone && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-4 border-t border-[#eadfc8] bg-[#fbf7ef]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <dl className="min-w-0">
            <dt className="text-sm text-[#5d5645]">Total</dt>
            <dd className="text-xl font-bold leading-tight text-[#0f4f2d]" data-testid="cart-total">
              {formatNaira(q.total)}
            </dd>
          </dl>
          <div className="flex shrink-0 flex-col">{checkout}</div>
        </div>
      )}
    </>
  );
}
