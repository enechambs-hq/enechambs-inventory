'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatNaira } from '@/lib/storefront/catalogue';
import { parseOrderList, type OrderList } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { formatWhen, StateBadge } from './OrderParts';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, Card, linkClass, Notice, Spinner } from './ui';

const PAGE_SIZE = 10;

export default function MyOrdersView() {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  // The result remembers which request produced it; "loading" is derived, never set in the effect.
  const requestKey = `${page}:${attempt}`;
  const [result, setResult] = useState<{ key: string; list: OrderList | null; kind: 'ok' | 'signed_out' | 'error'; message: string } | null>(null);
  const [list, setList] = useState<OrderList | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    storeRequest({ path: `storefront/orders?page=${page}&limit=${PAGE_SIZE}`, parse: parseOrderList, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) {
        setList(r.data);
        setResult({ key: requestKey, list: r.data, kind: 'ok', message: '' });
      } else if (r.kind === 'unauthenticated') setResult({ key: requestKey, list: null, kind: 'signed_out', message: '' });
      else setResult({ key: requestKey, list: null, kind: 'error', message: friendlyMessage(r) });
    });
    return () => controller.abort();
  }, [page, requestKey]);

  const status: 'loading' | 'ready' | 'signed_out' | 'error' = result === null || (result.key !== requestKey && result.kind !== 'ok' && !list) ? 'loading' : result.kind === 'ok' ? 'ready' : result.kind;
  const message = result?.message ?? '';

  if (status === 'loading' && !list) return <Spinner label="Loading your orders" />;
  if (status === 'signed_out') return <SignInPrompt next="/my-orders" reason="Sign in to see your orders." />;
  if (status === 'error') {
    return (
      <div className="space-y-4">
        <Notice tone="error">{message}</Notice>
        <button type="button" className={btnSecondary} onClick={() => setAttempt((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (!list || list.data.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-[#5d5645]">You have not placed any orders yet.</p>
        <Link href="/combos" className={`${btnPrimary} mt-4`}>Browse combos</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-label="Your orders">
        {list.data.map((o) => (
          <li key={o.orderNumber}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/my-orders/${o.orderNumber}`} className="font-bold text-[#0f4f2d] hover:underline">{o.orderNumber}</Link>
                <StateBadge state={o.state} />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-sm text-[#5d5645]">
                <span>{formatWhen(o.createdAt)}</span>
                <span className="font-semibold text-[#1d2a22]">{formatNaira(o.total)}</span>
              </div>
              {o.canPay && (
                <p className="mt-2 text-sm">
                  <Link href={`/my-orders/${o.orderNumber}`} className={linkClass}>Pay now</Link>
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {list.meta.totalPages > 1 && (
        <nav aria-label="Order pages" className="flex items-center justify-between text-sm">
          <button type="button" className={btnSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {list.meta.page} of {list.meta.totalPages}</span>
          <button type="button" className={btnSecondary} disabled={page >= list.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </nav>
      )}
    </div>
  );
}
