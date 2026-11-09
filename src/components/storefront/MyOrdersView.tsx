'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, CircleCheck, CircleX, Clock, Package, PackageCheck, ShieldAlert, ShoppingBag, Store, TimerOff, Truck } from 'lucide-react';
import { formatNaira } from '@/lib/storefront/catalogue';
import { orderStateLabel, parseOrderList, type OrderList, type OrderState, type OrderSummary } from '@/lib/storefront/orders';
import { storeRequest } from '@/lib/storefront/store-client';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import type { AppError } from '@/lib/errors/app-error';
import { normalizeError } from '@/lib/errors/normalize';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import { formatWhen } from './OrderParts';
import SignInPrompt from './SignInPrompt';
import { Spinner } from './ui';

const PAGE_SIZE = 10;

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const primaryClass = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] ${focus}`;
const pageButton = `inline-flex min-h-12 items-center justify-center rounded-full border border-[#d9ccaf] bg-white px-5 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

/** The same stage colours as the small badge used elsewhere (OrderParts.StateBadge). */
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

function stageIcon(o: OrderSummary): ReactNode {
  const props = { size: 16, 'aria-hidden': true as const };
  switch (o.state) {
    case 'paid':
      return <CircleCheck {...props} />;
    case 'processing':
      return <Package {...props} />;
    case 'dispatched':
      return o.fulfilmentMethod === 'delivery' ? <Truck {...props} /> : <Store {...props} />;
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

/** The page heading and sentence stay on screen in every state; the 640px column matches the order pages. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[40rem]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">My orders</h1>
        <p className="mt-1 text-base text-[#5d5645]">Your most recent orders come first.</p>
      </header>
      {children}
    </div>
  );
}

export default function MyOrdersView() {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // The result remembers which request produced it; "loading" is derived, never set in the effect.
  const requestKey = `${page}:${attempt}`;
  const [result, setResult] = useState<{ key: string; list: OrderList | null; kind: 'ok' | 'signed_out' | 'error'; error: AppError | null } | null>(null);
  const [list, setList] = useState<OrderList | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    storeRequest({ path: `storefront/orders?page=${page}&limit=${PAGE_SIZE}`, parse: parseOrderList, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) {
        setList(r.data);
        setResult({ key: requestKey, list: r.data, kind: 'ok', error: null });
      } else if (r.kind === 'unauthenticated') setResult({ key: requestKey, list: null, kind: 'signed_out', error: null });
      else setResult({ key: requestKey, list: null, kind: 'error', error: appErrorFromStore(r, { method: 'GET', what: 'your orders' }) });
    });
    return () => controller.abort();
  }, [page, requestKey]);

  const status: 'loading' | 'ready' | 'signed_out' | 'error' = result === null || (result.key !== requestKey && result.kind !== 'ok' && !list) ? 'loading' : result.kind === 'ok' ? 'ready' : result.kind;
  const loadError = result?.error ?? null;

  if (status === 'loading' && !list) {
    return (
      <Frame>
        <Spinner label="Loading your orders" />
      </Frame>
    );
  }
  if (status === 'signed_out') {
    return (
      <Frame>
        <SignInPrompt next="/my-orders" reason="Sign in to see your orders." />
      </Frame>
    );
  }
  if (status === 'error') {
    // A failed request is never shown as "no orders": if the details were somehow missing, the generic safe error is used.
    return (
      <Frame>
        <LoadErrorPanel error={loadError ?? normalizeError(null, { method: 'GET' })} onRetry={() => setAttempt((n) => n + 1)} title="We could not load your orders" />
      </Frame>
    );
  }
  if (!list || list.data.length === 0) {
    return (
      <Frame>
        <div className="flex flex-col items-center rounded-3xl border border-[#eadfc8] bg-white/70 px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6efe0] text-[#1a7a4a]">
            <ShoppingBag size={26} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[#1d2a22]">You have not placed any orders yet.</h2>
          <Link href="/combos" className={`${primaryClass} mt-5`}>
            Browse combos
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <ul className="space-y-3 sm:space-y-4" aria-label="Your orders">
        {list.data.map((o) => (
          <li key={o.orderNumber}>
            <Link
              href={`/my-orders/${o.orderNumber}`}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border border-[#eadfc8] bg-white p-4 transition hover:border-[#1a7a4a] ${focus}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="break-all text-base font-semibold text-[#0f4f2d]">{o.orderNumber}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${STAGE_STYLE[o.state]}`}>
                    {stageIcon(o)}
                    {orderStateLabel(o.state, o.fulfilmentMethod)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5d5645]">
                    <span>{formatWhen(o.createdAt)}</span>
                    {o.fulfilmentMethod && (
                      <span className="inline-flex items-center gap-1">
                        {o.fulfilmentMethod === 'delivery' ? <Truck size={14} aria-hidden="true" /> : <Store size={14} aria-hidden="true" />}
                        {o.fulfilmentMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                      </span>
                    )}
                  </p>
                  <span className="text-base font-bold text-[#1d2a22]">{formatNaira(o.total)}</span>
                </div>
              </div>
              <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[#5d5645]" />
            </Link>
            {o.canPay && (
              <Link href={`/my-orders/${o.orderNumber}`} className={`${primaryClass} mt-2 w-full sm:w-auto`}>
                Pay now
              </Link>
            )}
          </li>
        ))}
      </ul>
      {list.meta.totalPages > 1 && (
        <nav aria-label="Order pages" className="mt-6 flex items-center justify-between gap-3 text-base text-[#3b3a33]">
          <button type="button" className={pageButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-center">Page {list.meta.page} of {list.meta.totalPages}</span>
          <button type="button" className={pageButton} disabled={page >= list.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </nav>
      )}
    </Frame>
  );
}
