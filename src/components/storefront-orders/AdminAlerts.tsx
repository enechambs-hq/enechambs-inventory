'use client';

import Link from 'next/link';
import { AlertTriangle, ShoppingBag, RefreshCw } from 'lucide-react';
import { useAdminAlerts } from '@/hooks/useAdminAlerts';
import { alertItems, type AlertKey } from '@/lib/storefront-orders/alerts';
import { canDecideStorefrontPayments, canManageOnlineOrders } from '@/lib/nav-config';

const STYLE: Record<AlertKey, string> = {
  'payment-review': 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  'new-paid': 'border-[#b9e0c9] bg-[#e8f5ee] text-[#14693f] hover:bg-[#d7efe1]',
};

/**
 * Operational alerts for the admin interface: new paid orders awaiting fulfilment, and payments that need an
 * administrator's review (administrators only; staff never receive that number). `compact` is the header version.
 * Counts come from the API; nothing here counts or guesses.
 */
export default function AdminAlerts({ role, compact = false }: { role: string | null | undefined; compact?: boolean }) {
  const allowed = canManageOnlineOrders(role);
  const { status, alerts, error, retry } = useAdminAlerts(allowed);
  // Not for this user, or the online store is off (the API answered 403/404): show nothing, no error.
  if (!allowed || status === 'unavailable' || status === 'idle') return null;

  const wrap = compact ? 'flex shrink-0 items-center gap-2' : 'mb-4 flex flex-wrap items-center gap-2';
  const pill = 'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors';

  if (status === 'loading' && !alerts) {
    return <div className={wrap} role="status" aria-busy="true"><span className={`${pill} border-gray-200 text-gray-500`}>Checking orders…</span></div>;
  }

  const items = alerts ? alertItems(alerts, canDecideStorefrontPayments(role)) : [];
  return (
    <div className={wrap} data-testid="admin-alerts" aria-label="Order alerts" role="group">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={`${pill} ${STYLE[i.key]}`} data-testid={`alert-${i.key}`}>
          {i.key === 'payment-review' ? <AlertTriangle size={16} aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />}
          <span className={compact ? 'max-sm:sr-only' : ''}>{i.label}</span>
          <span className={`${compact ? 'sm:hidden' : 'hidden'} font-semibold`} aria-hidden="true">{i.count}</span>
        </Link>
      ))}
      {items.length === 0 && status !== 'error' && (
        <span className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-gray-600" data-testid="alerts-empty">
          <ShoppingBag size={16} aria-hidden="true" />
          <span className={compact ? 'max-lg:sr-only' : ''}>No new orders or payments to review</span>
        </span>
      )}
      {status === 'error' && (
        <button type="button" onClick={retry} title={error?.message} className={`${pill} border-gray-300 text-gray-700 hover:bg-gray-50`} data-testid="alerts-error">
          <RefreshCw size={16} aria-hidden="true" />
          <span className={compact ? 'max-sm:sr-only' : ''}>Alerts unavailable. Retry</span>
        </button>
      )}
    </div>
  );
}
