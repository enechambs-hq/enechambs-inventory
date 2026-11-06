'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isOrderNumber, paymentSettled, parseCustomerOrder, type CustomerOrder } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { OrderItems, PaymentLine, StateBadge } from './OrderParts';
import { startPayment } from './OrderActions';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, Card, linkClass, Notice, Spinner } from './ui';

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

  if (!valid || state === 'not_found') {
    return (
      <Card>
        <p className="text-[#3b3a33]">We could not find that order.</p>
        <Link href="/my-orders" className={`${btnPrimary} mt-4`}>My orders</Link>
      </Card>
    );
  }
  if (state === 'signed_out') {
    return <SignInPrompt next={`/checkout/payment-return?order=${encodeURIComponent(orderNumber ?? '')}`} reason="Sign in to see the result of your payment." />;
  }
  if (state === 'error') {
    return (
      <div className="space-y-4">
        <Notice tone="error">{message}</Notice>
        <button type="button" className={btnSecondary} onClick={check}>Check again</button>
      </div>
    );
  }
  if (state === 'checking' && !order) return <Spinner label="Confirming your payment" />;
  if (!order) return null;

  const detailHref = `/my-orders/${order.orderNumber}`;
  let headline: string;
  let tone: 'success' | 'info' | 'warn' | 'error' = 'info';
  let body: string;
  if (order.paymentState === 'paid') {
    headline = 'Payment confirmed';
    tone = 'success';
    body = 'Thank you! Your order is confirmed and we will prepare it.';
  } else if (order.paymentState === 'under_review') {
    headline = 'We received your payment';
    tone = 'warn';
    body = 'Something about it needs a quick check by our team. You do not need to pay again; we will update this order.';
  } else if (order.state === 'cancelled' || order.state === 'expired') {
    headline = order.state === 'expired' ? 'This order expired' : 'This order was cancelled';
    tone = 'warn';
    body = 'If you were charged, please contact us with your order number and we will sort it out.';
  } else if (order.paymentState === 'failed') {
    headline = 'Your payment did not go through';
    tone = 'error';
    body = 'You have not been charged for this order. You can try again.';
  } else {
    headline = state === 'timeout' ? 'Still waiting for confirmation' : 'Confirming your payment…';
    body =
      state === 'timeout'
        ? 'We have not received confirmation yet. If you already paid, please do not pay again: check My orders in a few minutes.'
        : 'This usually takes a few seconds.';
  }

  return (
    <div className="space-y-5">
      <Notice tone={tone}>
        <p className="text-base font-bold" data-testid="payment-headline">{headline}</p>
        <p className="mt-1">{body}</p>
      </Notice>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-[#0f4f2d]" data-testid="order-number">Order {order.orderNumber}</p>
          <StateBadge state={order.state} method={order.fulfilmentMethod} />
        </div>
        <div className="mt-3"><OrderItems order={order} /></div>
        <div className="mt-3"><PaymentLine order={order} /></div>
      </Card>
      <div className="flex flex-wrap gap-3">
        {order.canPay && (
          <button
            type="button"
            className={btnPrimary}
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
        )}
        {(state === 'timeout') && <button type="button" className={btnSecondary} onClick={check}>Check again</button>}
        <Link href={detailHref} className={btnSecondary}>View order</Link>
        <Link href="/my-orders" className={linkClass}>All my orders</Link>
      </div>
      {state === 'checking' && order && <Spinner label="Checking with the payment provider" />}
    </div>
  );
}
