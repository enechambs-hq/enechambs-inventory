'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Clock, Loader2, SearchX, Undo2 } from 'lucide-react';
import { formatNaira } from '@/lib/storefront/catalogue';
import { isOrderNumber, paymentReturnOutcome, paymentSettled, parseCustomerOrder, type CustomerOrder, type PaymentReturnAction, type PaymentReturnKind } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { StateBadge } from './OrderParts';
import { startPayment } from './OrderActions';
import SignInPrompt from './SignInPrompt';
import type { ReactNode } from 'react';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const primaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;
const secondaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;

type Tone = 'success' | 'info' | 'warn' | 'error';
const TONE: Record<Tone, { icon: string; heading: string }> = {
  success: { icon: 'bg-[#e5f4ea] text-[#0f4f2d]', heading: 'text-[#0f4f2d]' },
  warn: { icon: 'bg-[#fdf6dc] text-[#7a5a0c]', heading: 'text-[#7a5a0c]' },
  error: { icon: 'bg-[#fdf1ef] text-[#8a2a1d]', heading: 'text-[#8a2a1d]' },
  info: { icon: 'bg-[#f6efe0] text-[#5d5645]', heading: 'text-[#1d2a22]' },
};

/** The outcome block: icon, the heading (the page's h1), the order number, the next step and the actions. */
function Result({
  tone,
  icon,
  headline,
  orderNumber,
  body,
  children,
}: {
  tone: Tone;
  icon: ReactNode;
  headline: string;
  orderNumber?: string;
  body?: string | null;
  children?: ReactNode;
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'}>
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${TONE[tone].icon}`} aria-hidden="true">
        {icon}
      </div>
      <h1 className={`mt-4 text-3xl font-bold tracking-tight sm:text-4xl ${TONE[tone].heading}`} data-testid="payment-headline">
        {headline}
      </h1>
      {orderNumber && (
        <p className="mt-2 break-all text-xl font-semibold text-[#1d2a22]" data-testid="order-number">
          Order {orderNumber}
        </p>
      )}
      {body && <p className="mt-3 text-base text-[#3b3a33]">{body}</p>}
      {children && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>}
    </div>
  );
}

/** The order below the result: items with quantity and price, the totals, then the payment reference. */
function Summary({ order }: { order: CustomerOrder }) {
  const showBreakdown = order.fulfilment.method === 'delivery' && order.fulfilment.deliveryFee > 0;
  return (
    <>
      <section aria-labelledby="order-summary-heading" className="mt-8 rounded-2xl border border-[#eadfc8] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="order-summary-heading" className="text-lg font-semibold text-[#0f4f2d]">
            Order summary
          </h2>
          <StateBadge state={order.state} method={order.fulfilmentMethod} />
        </div>
        <ul className="mt-2 divide-y divide-[#f1e9d6]" aria-label={`Items in order ${order.orderNumber}`}>
          {order.items.map((i) => (
            <li key={i.slug} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-[#1d2a22]">{i.name}</p>
                <p className="text-sm text-[#5d5645]">
                  Quantity: {i.quantity} · {formatNaira(i.unitPrice)} each
                </p>
              </div>
              <p className="shrink-0 text-base font-semibold text-[#1d2a22]">{formatNaira(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-1 space-y-1.5 border-t border-[#f1e9d6] pt-3 text-base text-[#3b3a33]">
          {showBreakdown && (
            <>
              <div className="flex justify-between gap-4">
                <dt>Items</dt>
                <dd>{formatNaira(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Delivery</dt>
                <dd>{formatNaira(order.fulfilment.deliveryFee)}</dd>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="font-semibold text-[#1d2a22]">Total</dt>
            <dd className="text-2xl font-bold text-[#0f4f2d]">{formatNaira(order.total)}</dd>
          </div>
        </dl>
      </section>
      {order.paymentReference && <p className="mt-3 break-all text-sm text-[#5d5645]">Payment reference: {order.paymentReference}</p>}
    </>
  );
}


const POLL_MS = 3000;
const MAX_POLLS = 20; // about a minute

/**
 * Where Flutterwave sends the customer back. The URL may carry a `status`,
 * `tx_ref` and `transaction_id`; NONE of them is read. The page learns the
 * outcome only by asking our API to check with the provider by our own
 * reference, so editing the URL cannot make an order look paid.
 */
export default function PaymentReturnView({ orderNumber }: { orderNumber: string | null }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [state, setState] = useState<'checking' | 'signed_out' | 'not_found' | 'error' | 'timeout' | 'done'>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [round, setRound] = useState(0);
  const valid = !!orderNumber && isOrderNumber(orderNumber);

  // Asks the API (which asks the provider by OUR reference) until the payment
  // settles, a few seconds apart, for about a minute. Cancelled on unmount or
  // when a new round starts, so two loops never run at once.
  useEffect(() => {
    if (!valid || !orderNumber) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const step = () => {
      storeRequest({ path: `storefront/orders/${orderNumber}/payment/refresh`, method: 'POST', body: {}, parse: parseCustomerOrder }).then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          if (r.kind === 'unauthenticated') return setState('signed_out');
          if (r.kind === 'not_found') return setState('not_found');
          setMessage(friendlyMessage(r));
          return setState('error');
        }
        setOrder(r.data);
        if (paymentSettled(r.data)) return setState('done');
        polls += 1;
        if (polls >= MAX_POLLS) return setState('timeout');
        timer = setTimeout(step, POLL_MS);
      });
    };
    step();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderNumber, valid, round]);

  const check = () => {
    setState('checking');
    setRound((n) => n + 1);
  };

  const column = (children: ReactNode) => <div className="mx-auto max-w-[40rem]">{children}</div>;
  const ordersLink = (
    <Link href="/my-orders" className={primaryClass}>
      My orders
    </Link>
  );

  if (!valid || state === 'not_found') {
    return column(
      <Result tone="info" icon={<SearchX size={28} />} headline="We could not find that order.">
        {ordersLink}
      </Result>,
    );
  }
  if (state === 'signed_out') {
    return column(
      <>
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Your payment</h1>
        <SignInPrompt next={`/checkout/payment-return?order=${encodeURIComponent(orderNumber ?? '')}`} reason="Sign in to see the result of your payment." />
      </>,
    );
  }
  if (state === 'error') {
    return column(
      <div>
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Your payment</h1>
        <div role="alert" className="rounded-xl border border-[#e4b4ae] bg-[#fdf1ef] px-4 py-3 text-base text-[#8a2a1d]">
          {message}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" className={primaryClass} onClick={check}>
            Check again
          </button>
        </div>
      </div>,
    );
  }
  if (state === 'checking' && !order) {
    return column(
      <Result
        tone="info"
        icon={<Loader2 size={28} className="animate-spin" />}
        headline="Confirming your payment…"
        body="This usually takes a few seconds. Please keep this page open."
      />,
    );
  }
  if (!order) return null;

  const outcome = paymentReturnOutcome(order, state === 'timeout' ? 'timeout' : state === 'done' ? 'done' : 'checking');
  const detailHref = `/my-orders/${order.orderNumber}`;
  const actionNode = (action: PaymentReturnAction, cls: string): ReactNode => {
    switch (action) {
      case 'view_order':
        return (
          <Link key={action} href={detailHref} className={cls}>
            View order
          </Link>
        );
      case 'my_orders':
        return (
          <Link key={action} href="/my-orders" className={cls}>
            My orders
          </Link>
        );
      case 'continue_shopping':
        return (
          <Link key={action} href="/combos" className={cls}>
            Continue shopping
          </Link>
        );
      case 'check_again':
        return (
          <button key={action} type="button" className={cls} onClick={check}>
            Check again
          </button>
        );
      case 'try_again':
        // Offered only when the outcome allows it (the API says the order can still be paid).
        return (
          <button
            key={action}
            type="button"
            className={cls}
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              const r = await startPayment(order.orderNumber);
              if (!r.ok) {
                setRetrying(false);
                setMessage(r.message);
                setState('error');
              }
            }}
          >
            {retrying ? 'Opening payment…' : 'Try payment again'}
          </button>
        );
    }
  };
  const ICON: Record<PaymentReturnKind, ReactNode> = {
    paid: <CircleCheck size={28} />,
    under_review: <Clock size={28} />,
    refunded: <Undo2 size={28} />,
    closed: <Clock size={28} />,
    failed: <CircleAlert size={28} />,
    timeout: <Clock size={28} />,
    pending: <Loader2 size={28} className="animate-spin" />,
  };
  const actions = outcome.actions.length ? outcome.actions.map((a, i) => actionNode(a, i === 0 ? primaryClass : secondaryClass)) : null;

  return column(
    <>
      <Result tone={outcome.tone} icon={ICON[outcome.kind]} headline={outcome.headline} orderNumber={order.orderNumber} body={outcome.body}>
        {actions}
      </Result>
      <Summary order={order} />
    </>,
  );
}
