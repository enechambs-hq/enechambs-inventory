'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isOrderNumber, parseCustomerOrder, type CustomerOrder } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import OrderActions from './OrderActions';
import { formatWhen, OrderItems, PaymentLine, StateBadge, Timeline } from './OrderParts';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, Card, linkClass, Notice, Spinner } from './ui';

export default function OrderDetailView({ orderNumber, notice }: { orderNumber: string; notice?: string }) {
  const valid = isOrderNumber(orderNumber);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed_out' | 'not_found' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    storeRequest({ path: `storefront/orders/${orderNumber}`, parse: parseCustomerOrder, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) {
        setOrder(r.data);
        return setStatus('ready');
      }
      if (r.kind === 'unauthenticated') return setStatus('signed_out');
      if (r.kind === 'not_found') return setStatus('not_found');
      setMessage(friendlyMessage(r));
      setStatus('error');
    });
    return () => controller.abort();
  }, [orderNumber, valid, attempt]);

  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  async function recheck() {
    setChecking(true);
    setCheckNote(null);
    const r = await storeRequest({ path: `storefront/orders/${orderNumber}/payment/refresh`, method: 'POST', body: {}, parse: parseCustomerOrder });
    setChecking(false);
    if (r.ok) {
      setOrder(r.data);
      setCheckNote(r.data.paymentState === 'paid' ? 'Your payment is confirmed.' : 'No payment confirmation yet. If you just paid, wait a minute and check again.');
    } else setCheckNote(friendlyMessage(r));
  }

  if (!valid) return (
    <Card>
      <p>We could not find that order.</p>
      <Link href="/my-orders" className={`${btnPrimary} mt-4`}>My orders</Link>
    </Card>
  );
  if (status === 'loading') return <Spinner label="Loading your order" />;
  if (status === 'signed_out') return <SignInPrompt next={`/my-orders/${orderNumber}`} reason="Sign in to see this order." />;
  if (status === 'not_found') {
    return (
      <Card>
        <p>We could not find that order.</p>
        <Link href="/my-orders" className={`${btnPrimary} mt-4`}>My orders</Link>
      </Card>
    );
  }
  if (status === 'error' || !order) {
    return (
      <div className="space-y-4">
        <Notice tone="error">{message}</Notice>
        <button type="button" className={btnSecondary} onClick={retry}>Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {notice === 'payment_not_started' && (
        <Notice tone="warn">Your order is saved, but we could not open the payment page. You can pay below.</Notice>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#0f4f2d]" data-testid="order-number">{order.orderNumber}</h2>
          <StateBadge state={order.state} />
        </div>
        <p className="mt-1 text-xs text-[#8b7f6b]">Placed {formatWhen(order.createdAt)}</p>
        <div className="mt-4"><OrderItems order={order} /></div>
        <div className="mt-4 space-y-1"><PaymentLine order={order} /></div>
        {order.contact.note && <p className="mt-3 text-sm"><span className="font-semibold">Your note:</span> {order.contact.note}</p>}
        {order.paymentState === 'under_review' && (
          <div className="mt-3"><Notice tone="warn">Your payment is being checked by our team. You do not need to pay again.</Notice></div>
        )}
      </Card>
      <OrderActions order={order} onChange={setOrder} />
      {(order.paymentState === 'awaiting_payment' || order.paymentState === 'unpaid' || order.paymentState === 'failed') && order.state === 'awaiting_payment' && (
        <div className="space-y-2">
          <button type="button" className={btnSecondary} disabled={checking} onClick={recheck}>
            {checking ? 'Checking…' : 'I have paid: check my payment'}
          </button>
          {checkNote && <p role="status" className="text-sm text-[#3b3a33]">{checkNote}</p>}
        </div>
      )}
      {order.timeline.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8b7f6b]">History</h3>
          <Timeline order={order} />
        </Card>
      )}
      <p><Link href="/my-orders" className={linkClass}>← All my orders</Link></p>
    </div>
  );
}
