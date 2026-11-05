'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cartFingerprint, toRequestItems } from '@/lib/storefront/cart';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import { forgetAttempt, rememberHandoff, requestIdFor, takeHandoff } from '@/lib/storefront/checkout-attempt';
import { formatNaira } from '@/lib/storefront/catalogue';
import { issueMessage, parseCustomerOrder, quoteIsPurchasable } from '@/lib/storefront/orders';
import { loginHref } from '@/lib/storefront/redirects';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { startPayment } from './OrderActions';
import PaymentHandoff from './PaymentHandoff';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, Card, inputClass, linkClass, Notice, Spinner } from './ui';
import { useHydrated } from './useHydrated';
import { useQuote } from './useQuote';
import { useSession } from './use-session';

const NOTE_MAX = 500;

export default function CheckoutView() {
  const router = useRouter();
  const lines = useCart();
  const hydrated = useHydrated();
  const liveQuote = useQuote(lines, hydrated);
  // Once the order is placed the cart is cleared, which would turn the live quote into "empty" while we wait for the
  // payment page. Keep showing the quote as it was when the customer clicked, until the browser leaves.
  const [handoff, setHandoff] = useState<{ quote: typeof liveQuote; orderNumber: string } | null>(null);
  const quote = handoff?.quote ?? liveQuote;
  const session = useSession();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null);

  // Coming back here with the browser's Back button after the hand-over: the cart is spent, so go to the pending
  // order (where "Pay now" is one tap away) instead of showing an empty checkout.
  useEffect(() => {
    const pending = takeHandoff(window.sessionStorage);
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (pending && navigation?.type === 'back_forward') router.replace(`/my-orders/${pending}`);
  }, [router]);
  // The same, when the browser restores this page from its back/forward cache instead of reloading it.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && handoff) router.replace(`/my-orders/${handoff.orderNumber}`);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [handoff, router]);

  if (!hydrated || session.status === 'loading' || quote.status === 'loading') return <Spinner label="Preparing checkout" />;

  if (quote.status === 'empty') {
    return (
      <Card className="text-center">
        <p className="text-[#5d5645]">Your cart is empty, so there is nothing to check out.</p>
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
  if (session.status === 'unavailable') {
    return <Notice tone="error">We could not check your sign-in right now. Please refresh the page in a moment.</Notice>;
  }

  const q = quote.quote;
  const purchasable = quoteIsPurchasable(q);

  async function placeOrder() {
    if (session.status !== 'signed_in' || !purchasable || busy) return;
    setBusy(true);
    setFailure(null);
    // One key per cart contents: a double click or retry returns the SAME order.
    const requestId = requestIdFor(cartFingerprint(lines), window.sessionStorage);
    const trimmed = note.trim();
    const created = await storeRequest({
      path: 'storefront/orders',
      method: 'POST',
      body: { items: toRequestItems(lines), requestId, ...(trimmed ? { note: trimmed } : {}) },
      parse: parseCustomerOrder,
    });
    if (!created.ok) {
      setBusy(false);
      if (created.kind === 'unauthenticated') return router.push(loginHref('/checkout'));
      return setFailure({ message: friendlyMessage(created), code: created.code });
    }
    // The order now holds the stock: the cart is spent and the next purchase needs a new key.
    const orderNumber = created.data.orderNumber;
    forgetAttempt(window.sessionStorage);
    rememberHandoff(window.sessionStorage, orderNumber);
    setHandoff({ quote: liveQuote, orderNumber });
    cartActions.clear();

    const paid = await startPayment(orderNumber);
    if (!paid.ok) {
      takeHandoff(window.sessionStorage);
      // The order exists and is payable later from My orders.
      router.push(`/my-orders/${orderNumber}?notice=payment_not_started`);
    }
    // On success the browser is already navigating to the hosted checkout.
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      {busy && <PaymentHandoff orderNumber={handoff?.orderNumber} />}
      <div className="space-y-5">
        <Card>
          <h2 className="text-lg font-bold text-[#0f4f2d]">Your order</h2>
          <ul className="mt-3 divide-y divide-[#f1e9d6]" aria-label="Order items">
            {q.lines.map((l) => (
              <li key={l.slug} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-[#1d2a22]">
                    {l.name ?? l.slug} <span className="text-[#8b7f6b]">× {l.quantity}</span>
                  </p>
                  {!l.purchasable && <p role="alert" className="text-xs font-medium text-[#8a2a1d]">{issueMessage(l.issue, q.limits)}</p>}
                </div>
                <p className="font-semibold">{l.lineTotal != null ? formatNaira(l.lineTotal) : '—'}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <Link href="/cart" className={linkClass}>
              Edit cart
            </Link>
          </p>
        </Card>

        {session.status === 'signed_out' ? (
          <SignInPrompt next="/checkout" reason="You need an account to place an order." />
        ) : (
          <Card>
            <h2 className="text-lg font-bold text-[#0f4f2d]">Contact details</h2>
            <dl className="mt-3 grid gap-1 text-sm">
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-[#8b7f6b]">Name</dt><dd className="min-w-0 break-words">{session.profile.name}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-[#8b7f6b]">Phone</dt><dd className="min-w-0 break-words">{session.profile.phone}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-[#8b7f6b]">Email</dt><dd className="min-w-0 break-words">{session.profile.email}</dd></div>
            </dl>
            <label htmlFor="note" className="mt-4 block text-sm font-semibold text-[#3b3a33]">
              Note for this order <span className="font-normal text-[#8b7f6b]">(optional)</span>
            </label>
            <textarea id="note" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Anything we should know?" />
            <p className="mt-1 text-xs text-[#8b7f6b]">{note.length}/{NOTE_MAX}</p>
          </Card>
        )}
      </div>

      <aside>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b7f6b]">Total</h2>
          <p className="mt-1 text-3xl font-extrabold text-[#0f4f2d]" data-testid="checkout-total">{formatNaira(q.total)}</p>
          <p className="mt-1 text-xs text-[#8b7f6b]">You pay securely on Flutterwave. We hold your items for a short time while you pay.</p>
          {failure && (
            <div className="mt-3 space-y-2">
              <Notice tone="error">{failure.message}</Notice>
              {(failure.code === 'TOO_MANY_OPEN_ORDERS') && <Link href="/my-orders" className={linkClass}>Go to My orders</Link>}
              {(failure.code === 'INSUFFICIENT_STOCK' || failure.code === 'COMBO_UNAVAILABLE') && <Link href="/cart" className={linkClass}>Review cart</Link>}
            </div>
          )}
          {!purchasable && <div className="mt-3"><Notice tone="warn">Some items need your attention. <Link href="/cart" className={linkClass}>Review cart</Link></Notice></div>}
          <button
            type="button"
            className={`${btnPrimary} mt-4 w-full`}
            disabled={busy || !purchasable || session.status !== 'signed_in'}
            onClick={placeOrder}
          >
            {handoff ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Opening payment…
              </>
            ) : busy ? (
              'Placing your order…'
            ) : (
              'Place order and pay'
            )}
          </button>
        </Card>
      </aside>
    </div>
  );
}
