'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, MapPin, ShoppingBag } from 'lucide-react';
import { addressErrors, emptyAddressInput, toRequestAddress, type AddressErrors, type FulfilmentChoice as Choice } from '@/lib/storefront/addresses';
import { cartFingerprint, toRequestItems } from '@/lib/storefront/cart';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import { forgetAttempt, rememberHandoff, requestIdFor, takeHandoff } from '@/lib/storefront/checkout-attempt';
import { formatNaira } from '@/lib/storefront/catalogue';
import { issueMessage, parseCustomerOrder, quoteIsPurchasable, type FulfilmentMethod } from '@/lib/storefront/orders';
import { loginHref } from '@/lib/storefront/redirects';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { ADDRESS_FIELD_ORDER } from './AddressForm';
import AddressModal from './AddressModal';
import AddressPicker, { NEW_ADDRESS, type NewAddress } from './AddressPicker';
import { CheckoutSection, checkoutFocus } from './CheckoutSection';
import FulfilmentChoice from './FulfilmentChoice';
import NewAddressPanel from './NewAddressPanel';
import { startPayment } from './OrderActions';
import PaymentHandoff from './PaymentHandoff';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, linkClass, Notice, Spinner } from './ui';
import { useAddresses } from './useAddresses';
import { useCheckoutOptions } from './useCheckoutOptions';
import { useHydrated } from './useHydrated';
import { useMediaQuery } from './useMediaQuery';
import { useQuote } from './useQuote';
import { useSession } from './use-session';

const NOTE_MAX = 500;

const payClass = `inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 ${checkoutFocus}`;
const noteClass =
  'mt-1.5 block w-full rounded-xl border border-[#d9ccaf] bg-white px-4 py-3 text-base text-[#1d2a22] placeholder:text-[#8b7f6b] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]';
const inlineLink = `${linkClass} inline-flex min-h-11 items-center text-base`;

export default function CheckoutView() {
  const router = useRouter();
  const lines = useCart();
  const hydrated = useHydrated();
  // Delivery by default; delivery adds the delivery fee, pickup is free.
  const [method, setMethod] = useState<FulfilmentMethod>('delivery');
  const liveQuote = useQuote(lines, hydrated, method);
  // Once the order is placed the cart is cleared, which would turn the live quote into "empty" while we wait for the
  // payment page. Keep showing the quote as it was when the customer clicked, until the browser leaves.
  const [handoff, setHandoff] = useState<{ quote: typeof liveQuote; orderNumber: string } | null>(null);
  const quote = handoff?.quote ?? liveQuote;
  const session = useSession();
  const options = useCheckoutOptions();
  const addresses = useAddresses(session.status === 'signed_in');
  // Which delivery address is chosen: a saved address id, NEW_ADDRESS (typed in at checkout), or null (= the default).
  const [selection, setSelection] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState<NewAddress | null>(null);
  // The "new address" form: beside the total on laptops, a modal on phones.
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(emptyAddressInput());
  const [saveToBook, setSaveToBook] = useState(true);
  const [draftErrors, setDraftErrors] = useState<AddressErrors>({});
  const [needAddress, setNeedAddress] = useState(false);
  // Tablets and laptops show the new-address form in the form column; phones get a modal.
  const isLaptop = useMediaQuery('(min-width: 768px)');
  // Phones get a payment bar instead of the summary card. Only one of them is ever rendered, so the total and the
  // "Place order and pay" action exist once on the page.
  const phone = useMediaQuery('(max-width: 639px)');
  // True while the hand-over dialog is on screen (the phone bar hides meanwhile).
  const [handoffShown, setHandoffShown] = useState(false);
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

  const heading = (
    <header className="mb-6 md:mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Checkout</h1>
      <p className="mt-1 text-base text-[#5d5645]">Check your order, choose how to get it, then pay.</p>
    </header>
  );

  if (!hydrated || session.status === 'loading' || quote.status === 'loading') {
    return (
      <>
        {heading}
        <Spinner label="Preparing checkout" />
      </>
    );
  }

  if (quote.status === 'empty') {
    return (
      <>
        <header className="mb-6 md:mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Checkout</h1>
        </header>
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
        <div className="space-y-4">
          <Notice tone="error">{quote.message}</Notice>
          <button type="button" className={btnSecondary} onClick={quote.retry}>
            Try again
          </button>
        </div>
      </>
    );
  }
  if (session.status === 'unavailable') {
    return (
      <>
        {heading}
        <Notice tone="error">We could not check your sign-in right now. Please refresh the page in a moment.</Notice>
      </>
    );
  }

  const q = quote.quote;
  const purchasable = quoteIsPurchasable(q);
  const saved = addresses.status === 'ready' ? addresses.addresses : [];
  // The default address (else the first) is chosen until the customer picks another.
  const selectedId = selection ?? (saved.find((a) => a.isDefault) ?? saved[0])?.id ?? null;

  /** What we tell the API about delivery, or null while the customer still has to choose an address. */
  function fulfilmentChoice(): Choice | null {
    if (method === 'pickup') return { method: 'pickup' };
    if (selectedId === NEW_ADDRESS && newAddress) {
      return { method: 'delivery', address: toRequestAddress(newAddress.input), saveAddress: newAddress.saveToBook };
    }
    return selectedId && selectedId !== NEW_ADDRESS ? { method: 'delivery', addressId: selectedId } : null;
  }

  function openPanel() {
    if (newAddress) {
      setDraft(newAddress.input);
      setSaveToBook(newAddress.saveToBook);
    }
    setDraftErrors({});
    setPanelOpen(true);
  }

  function useDraftAddress() {
    const errors = addressErrors(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(errors);
      return;
    }
    setNewAddress({ input: draft, saveToBook });
    setSelection(NEW_ADDRESS);
    setNeedAddress(false);
    setPanelOpen(false);
  }

  /** After a failed address submit: focus the first invalid field, keeping the form's title in view when it is the first. */
  function focusFirstInvalid(errors: AddressErrors) {
    const first = ADDRESS_FIELD_ORDER.find((key) => errors[key]);
    if (!first) return;
    const suffix = { recipientName: 'name', recipientPhone: 'phone', addressLine: 'line', city: 'city', state: 'state', label: 'label' }[first];
    window.setTimeout(() => {
      const field = document.getElementById(`checkout-address-${suffix}`);
      if (!field) return;
      field.focus({ preventScroll: true });
      if (first === 'recipientName') document.getElementById('new-address-title')?.scrollIntoView({ block: 'start' });
      else field.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  async function placeOrder() {
    if (session.status !== 'signed_in' || !purchasable || busy) return;
    if (method === 'delivery' && addresses.status !== 'ready') return;
    const choice = fulfilmentChoice();
    if (!choice) {
      // Delivery without an address: ask for one instead of failing silently.
      setNeedAddress(true);
      openPanel();
      return;
    }
    setBusy(true);
    setFailure(null);
    // One key per cart contents AND delivery choice: a double click or retry returns the SAME order, but changing
    // the address (or switching to pickup) is a different order.
    const requestId = requestIdFor(`${cartFingerprint(lines)}|${JSON.stringify(choice)}`, window.sessionStorage);
    const trimmed = note.trim();
    const created = await storeRequest({
      path: 'storefront/orders',
      method: 'POST',
      body: { items: toRequestItems(lines), requestId, fulfilment: choice, ...(trimmed ? { note: trimmed } : {}) },
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

  const lineItems = (
    <ul className="divide-y divide-[#f1e9d6]" aria-label="Order items">
      {q.lines.map((l) => (
        <li key={l.slug} className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-base font-medium text-[#1d2a22]">{l.name ?? l.slug}</p>
            <p className="text-sm text-[#5d5645]">Quantity: {l.quantity}</p>
            {!l.purchasable && (
              <p role="alert" className="mt-1 text-sm font-medium text-[#8a2a1d]">
                {issueMessage(l.issue, q.limits)}
              </p>
            )}
          </div>
          <p className="shrink-0 text-base font-semibold text-[#1d2a22]">{l.lineTotal != null ? formatNaira(l.lineTotal) : '—'}</p>
        </li>
      ))}
    </ul>
  );
  const editCart = (
    <Link href="/cart" className={inlineLink}>
      Edit cart
    </Link>
  );
  const totals = (
    <dl className="space-y-1.5 text-base text-[#3b3a33]">
      <div className="flex justify-between gap-4">
        <dt>Items</dt>
        <dd>{formatNaira(q.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{method === 'delivery' ? 'Delivery' : 'Pickup'}</dt>
        <dd>{method === 'delivery' ? formatNaira(q.deliveryFee) : 'Free'}</dd>
      </div>
    </dl>
  );
  const failureNotice = failure && (
    <div className="space-y-2">
      <Notice tone="error">{failure.message}</Notice>
      {failure.code === 'TOO_MANY_OPEN_ORDERS' && (
        <Link href="/my-orders" className={inlineLink}>
          Go to My orders
        </Link>
      )}
      {(failure.code === 'INSUFFICIENT_STOCK' || failure.code === 'COMBO_UNAVAILABLE') && (
        <Link href="/cart" className={inlineLink}>
          Review cart
        </Link>
      )}
    </div>
  );
  const attentionNotice = !purchasable && (
    <Notice tone="warn">
      Some items need your attention.{' '}
      <Link href="/cart" className={linkClass}>
        Review cart
      </Link>
    </Notice>
  );
  const secureNote = <p className="text-sm text-[#5d5645]">You pay securely on Flutterwave. We hold your items for a short time while you pay.</p>;
  const payLabel = handoff ? (
    <>
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      Opening payment…
    </>
  ) : busy ? (
    'Placing your order…'
  ) : (
    'Place order and pay'
  );
  const payDisabled = busy || !purchasable || session.status !== 'signed_in';
  const newAddressPanel = (
    <NewAddressPanel value={draft} onChange={setDraft} errors={draftErrors} saveToBook={saveToBook} onSaveToBook={setSaveToBook} onUse={useDraftAddress} onCancel={() => setPanelOpen(false)} />
  );

  return (
    <>
      {heading}
      {busy && <PaymentHandoff orderNumber={handoff?.orderNumber} onShown={setHandoffShown} />}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          {phone && (
            <section aria-labelledby="summary-heading" className="rounded-2xl border border-[#d9ccaf] bg-white p-4">
              <h2 id="summary-heading" className="text-lg font-semibold text-[#0f4f2d]">
                Order summary
              </h2>
              <div className="mt-1">{lineItems}</div>
              <div className="-mt-1 mb-2">{editCart}</div>
              <div className="border-t border-[#f1e9d6] pt-3">{totals}</div>
            </section>
          )}

          {session.status === 'signed_out' ? (
            <SignInPrompt next="/checkout" reason="You need an account to place an order." />
          ) : (
            <>
              <CheckoutSection number={1} id="fulfilment-heading" title="Delivery or pickup">
                <FulfilmentChoice value={method} onChange={setMethod} deliveryFee={options?.deliveryFee ?? null} disabled={busy} />
              </CheckoutSection>

              <CheckoutSection number={2} id="where-heading" title="Where to">
                {method === 'delivery' ? (
                  <AddressPicker
                    addresses={addresses}
                    selected={selectedId}
                    newAddress={newAddress}
                    onSelect={setSelection}
                    onAdd={() => {
                      setDraft(emptyAddressInput());
                      setSaveToBook(true);
                      setDraftErrors({});
                      setPanelOpen(true);
                    }}
                    onEditNew={openPanel}
                    onRetry={addresses.reload}
                    needAddress={needAddress}
                  />
                ) : (
                  <div>
                    <p className="text-base font-semibold text-[#1d2a22]">Collect from</p>
                    <div className="mt-2 flex items-start gap-2 text-base text-[#3b3a33]">
                      <MapPin size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[#0f4f2d]" />
                      <div>
                        <p className="font-medium">{options?.pickup.address ?? 'Our store'}</p>
                        <p className="text-[#5d5645]">Open {options?.pickup.hours ?? '9am - 5pm'}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-[#5d5645]">We will let you know when your order is ready to collect.</p>
                  </div>
                )}
              </CheckoutSection>

              {method === 'delivery' && panelOpen && isLaptop && (
                <div className="rounded-2xl border border-[#d9ccaf] bg-white p-4 sm:p-6">{newAddressPanel}</div>
              )}

              <CheckoutSection number={3} id="contact-heading" title="Contact details">
                <dl className="grid gap-2 text-base">
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-[#5d5645]">Name</dt>
                    <dd className="min-w-0 break-words">{session.profile.name}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-[#5d5645]">Phone</dt>
                    <dd className="min-w-0 break-words">{session.profile.phone}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-[#5d5645]">Email</dt>
                    <dd className="min-w-0 break-words">{session.profile.email}</dd>
                  </div>
                </dl>
                <label htmlFor="note" className="mt-5 block text-base font-semibold text-[#1d2a22]">
                  Note for this order <span className="font-normal text-[#5d5645]">(optional)</span>
                </label>
                <textarea id="note" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} className={noteClass} placeholder="Anything we should know?" />
                <p className="mt-1 text-sm text-[#5d5645]">
                  {note.length}/{NOTE_MAX}
                </p>
              </CheckoutSection>
            </>
          )}

          {phone && <div className="pt-1">{secureNote}</div>}
        </div>

        {!phone && (
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[#d9ccaf] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#0f4f2d]">Order summary</h2>
              <div className="mt-1">{lineItems}</div>
              <div className="-mt-1 mb-2">{editCart}</div>
              <div className="border-t border-[#f1e9d6] pt-3">{totals}</div>
              <dl className="mt-3 flex items-baseline justify-between gap-4 border-t border-[#f1e9d6] pt-3">
                <dt className="text-base font-semibold text-[#1d2a22]">Total</dt>
                <dd className="text-2xl font-bold text-[#0f4f2d]" data-testid="checkout-total">
                  {formatNaira(q.total)}
                </dd>
              </dl>
              {(failureNotice || attentionNotice) && (
                <div className="mt-4 space-y-3">
                  {failureNotice}
                  {attentionNotice}
                </div>
              )}
              <button type="button" className={`${payClass} mt-4 w-full`} disabled={payDisabled} onClick={placeOrder}>
                {payLabel}
              </button>
              <div className="mt-3">{secureNote}</div>
            </div>
          </aside>
        )}
      </div>

      {phone && !handoffShown && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[#eadfc8] bg-[#fbf7ef]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          {(failureNotice || attentionNotice) && (
            <div className="mb-3 max-h-[40dvh] space-y-3 overflow-y-auto">
              {failureNotice}
              {attentionNotice}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <dl className="min-w-0">
              <dt className="text-sm text-[#5d5645]">Total</dt>
              <dd className="text-xl font-bold leading-tight text-[#0f4f2d]" data-testid="checkout-total">
                {formatNaira(q.total)}
              </dd>
            </dl>
            <button type="button" className={`${payClass} shrink-0 px-5`} disabled={payDisabled} onClick={placeOrder}>
              {payLabel}
            </button>
          </div>
        </div>
      )}

      {method === 'delivery' && panelOpen && !isLaptop && (
        <AddressModal labelledBy="new-address-title" onClose={() => setPanelOpen(false)}>
          {newAddressPanel}
        </AddressModal>
      )}
    </>
  );
}
