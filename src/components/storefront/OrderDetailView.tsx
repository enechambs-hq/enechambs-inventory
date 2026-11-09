'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleCheck, CircleX, Clock, Package, PackageCheck, ShieldAlert, Store, TimerOff, Truck } from 'lucide-react';
import { formatNaira } from '@/lib/storefront/catalogue';
import {
  isOrderNumber,
  orderStateLabel,
  parseCustomerOrder,
  PAYMENT_STATE_LABEL,
  stageMessage,
  timelineLabel,
  type CustomerOrder,
  type OrderState,
} from '@/lib/storefront/orders';
import { storeRequest } from '@/lib/storefront/store-client';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import type { AppError } from '@/lib/errors/app-error';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import OrderActions from './OrderActions';
import { formatWhen } from './OrderParts';
import SignInPrompt from './SignInPrompt';
import { Notice, Spinner } from './ui';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const primaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;
const secondaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;
const sectionClass = 'rounded-2xl border border-[#eadfc8] bg-white p-4 sm:p-6';
const headingClass = 'text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl';

/** The same stage colours as the small badge on the order list (OrderParts.StateBadge), for the larger status line. */
const STAGE_STYLE: Record<OrderState, string> = {
  awaiting_payment: 'bg-[#fdf6dc] text-[#7a5a0c]',
  paid: 'bg-[#e0f2fb] text-[#0b5373]',
  processing: 'bg-[#ffecd6] text-[#9a4a05]',
  dispatched: 'bg-[#dbe8ff] text-[#1d4ed8]',
  completed: 'bg-[#cdeedb] text-[#0f5c30]',
  cancelled: 'bg-[#efece4] text-[#5d5645]',
  expired: 'bg-[#efece4] text-[#5d5645]',
  cancellation_pending: 'bg-[#fdf6dc] text-[#7a5a0c]',
  refund_processing: 'bg-[#fdf6dc] text-[#7a5a0c]',
  under_review: 'bg-[#fdf6dc] text-[#7a5a0c]',
};

function stageIcon(order: CustomerOrder): ReactNode {
  const props = { size: 20, 'aria-hidden': true as const };
  switch (order.state) {
    case 'paid':
      return <CircleCheck {...props} />;
    case 'processing':
      return <Package {...props} />;
    case 'dispatched':
      return order.fulfilmentMethod === 'delivery' ? <Truck {...props} /> : <Store {...props} />;
    case 'completed':
      return <PackageCheck {...props} />;
    case 'cancelled':
      return <CircleX {...props} />;
    case 'expired':
      return <TimerOff {...props} />;
    case 'under_review':
      return <ShieldAlert {...props} />;
    default:
      return <Clock {...props} />;
  }
}

/** What the customer should read under the stage. Stage-specific text only where it is true for that stage. */
function nextStep(order: CustomerOrder): string {
  const stage = stageMessage(order.state, order.fulfilmentMethod);
  if (stage) return stage;
  if (order.state === 'paid') return 'Thank you! Your order is confirmed and we will prepare it.';
  if (order.paymentState === 'under_review') return 'Your payment is being checked by our team. You do not need to pay again.';
  return 'You can come back here for the latest updates.';
}

function Fulfilment({ order }: { order: CustomerOrder }) {
  const f = order.fulfilment;
  if (f.method === 'delivery' && f.address) {
    return (
      <section aria-labelledby="fulfilment-heading" className={sectionClass}>
        <h2 id="fulfilment-heading" className="flex items-center gap-2 text-lg font-semibold text-[#0f4f2d]">
          <Truck size={20} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 break-words">Delivery to {f.address.recipientName}</span>
        </h2>
        <p className="mt-2 break-words text-base text-[#1d2a22]">{[f.address.addressLine, f.address.city, f.address.state].filter(Boolean).join(', ')}</p>
        <p className="mt-1 text-sm text-[#5d5645]">{f.address.recipientPhone}</p>
        <Note order={order} />
      </section>
    );
  }
  if (f.method === 'pickup' && f.pickup) {
    return (
      <section aria-labelledby="fulfilment-heading" className={sectionClass}>
        <h2 id="fulfilment-heading" className="flex items-center gap-2 text-lg font-semibold text-[#0f4f2d]">
          <Store size={20} aria-hidden="true" className="shrink-0" />
          Pickup
        </h2>
        <p className="mt-2 break-words text-base text-[#1d2a22]">{f.pickup.address}</p>
        <p className="mt-1 text-sm text-[#5d5645]">Open {f.pickup.hours}</p>
        <Note order={order} />
      </section>
    );
  }
  return order.contact.note ? (
    <section className={sectionClass}>
      <Note order={order} bare />
    </section>
  ) : null;
}

function Note({ order, bare = false }: { order: CustomerOrder; bare?: boolean }) {
  if (!order.contact.note) return null;
  return (
    <p className={`${bare ? '' : 'mt-4 border-t border-[#f1e9d6] pt-3 '}break-words text-base text-[#3b3a33]`}>
      <span className="font-semibold">Your note:</span> {order.contact.note}
    </p>
  );
}

function Items({ order }: { order: CustomerOrder }) {
  const showBreakdown = order.fulfilment.method === 'delivery' && order.fulfilment.deliveryFee > 0;
  return (
    <section aria-labelledby="items-heading" className={sectionClass}>
      <h2 id="items-heading" className="text-lg font-semibold text-[#0f4f2d]">
        Items
      </h2>
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
  );
}

function History({ order }: { order: CustomerOrder }) {
  if (order.timeline.length === 0) return null;
  const last = order.timeline.length - 1;
  return (
    <section aria-labelledby="history-heading" className={sectionClass}>
      <h2 id="history-heading" className="text-lg font-semibold text-[#0f4f2d]">
        Order history
      </h2>
      <ol className="mt-4 space-y-4 border-l-2 border-[#eadfc8] pl-4" aria-label="Order history">
        {order.timeline.map((t, i) => (
          <li key={`${t.event}-${i}`} className="relative">
            <span aria-hidden="true" className={`absolute -left-[1.4rem] top-2 h-2.5 w-2.5 rounded-full ${i === last ? 'bg-[#0f4f2d]' : 'bg-[#d9ccaf]'}`} />
            <p className={`text-base ${i === last ? 'font-semibold text-[#0f4f2d]' : 'text-[#1d2a22]'}`}>{timelineLabel(t.event, order.fulfilmentMethod)}</p>
            <p className="text-sm text-[#5d5645]">{formatWhen(t.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const titleOnly = (children: ReactNode) => (
  <div className="mx-auto max-w-[40rem]">
    <h1 className={`mb-5 ${headingClass}`}>Your order</h1>
    {children}
  </div>
);


export default function OrderDetailView({ orderNumber, notice }: { orderNumber: string; notice?: string }) {
  const valid = isOrderNumber(orderNumber);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed_out' | 'not_found' | 'error'>('loading');
  const [loadError, setLoadError] = useState<AppError | null>(null);
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
      setLoadError(appErrorFromStore(r, { method: 'GET', one: 'order', what: 'this order' }));
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
    } else setCheckNote(appErrorFromStore(r, { method: 'POST', idempotent: true }).message);
  }

  if (!valid)
    return titleOnly(
      <>
        <p className="text-base text-[#3b3a33]">We could not find that order.</p>
        <Link href="/my-orders" className={`${primaryClass} mt-5`}>
          My orders
        </Link>
      </>,
    );
  if (status === 'loading') return titleOnly(<Spinner label="Loading your order" />);
  if (status === 'signed_out') return titleOnly(<SignInPrompt next={`/my-orders/${orderNumber}`} reason="Sign in to see this order." />);
  if (status === 'not_found') {
    return titleOnly(
      <>
        <p className="text-base text-[#3b3a33]">We could not find that order.</p>
        <Link href="/my-orders" className={`${primaryClass} mt-5`}>
          My orders
        </Link>
      </>,
    );
  }
  if (status === 'error' || !order) {
    return titleOnly(
      <LoadErrorPanel
        error={loadError ?? appErrorFromStore({ ok: false, kind: 'error', status: 500, message: '' }, { method: 'GET' })}
        onRetry={retry}
        title="We could not load this order"
        actions={<Link href="/my-orders" className={secondaryClass}>My orders</Link>}
      />,
    );
  }

  const canCheck = (order.paymentState === 'awaiting_payment' || order.paymentState === 'unpaid' || order.paymentState === 'failed') && order.state === 'awaiting_payment';

  return (
    <div className="mx-auto max-w-[40rem]">
      <Link href="/my-orders" className={`-ml-2 mb-3 inline-flex min-h-11 items-center rounded-full px-2 text-base font-medium text-[#1a7a4a] underline-offset-4 hover:underline ${focus}`}>
        ← All my orders
      </Link>

      <header>
        <h1 className={`break-all ${headingClass}`} data-testid="order-number">
          {order.orderNumber}
        </h1>
        <p className="mt-1 text-base text-[#5d5645]">Placed {formatWhen(order.createdAt)}</p>
      </header>

      <div className="mt-6" role="status">
        <p className="text-sm text-[#5d5645]">Order status</p>
        <p className={`mt-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold ${STAGE_STYLE[order.state]}`}>
          {stageIcon(order)}
          {orderStateLabel(order.state, order.fulfilmentMethod)}
        </p>
        <p className="mt-3 text-base text-[#3b3a33]">{nextStep(order)}</p>
      </div>

      <div className="mt-6 space-y-4 empty:mt-0">
        {notice === 'payment_not_started' && <Notice tone="warn">Your order is saved, but we could not open the payment page. You can pay below.</Notice>}
        <OrderActions order={order} onChange={setOrder} />
        {canCheck && (
          <div className="space-y-2">
            <button type="button" className={secondaryClass} disabled={checking} onClick={recheck}>
              {checking ? 'Checking…' : 'I have paid: check my payment'}
            </button>
            {checkNote && (
              <p role="status" className="text-base text-[#3b3a33]">
                {checkNote}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-6">
        <Fulfilment order={order} />
        <Items order={order} />
        <div className="space-y-1">
          {order.paymentState !== 'paid' && <p className="text-base text-[#3b3a33]">Payment: {PAYMENT_STATE_LABEL[order.paymentState]}</p>}
          {order.paymentReference && <p className="break-all text-sm text-[#5d5645]">Payment reference: {order.paymentReference}</p>}
        </div>
        <History order={order} />
      </div>
    </div>
  );
}
