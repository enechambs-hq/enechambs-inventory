'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import ActionDialog from '@/components/promotions/ActionDialog';
import SkeletonRow from '@/components/shared/SkeletonRow';
import { canManageOnlineOrders } from '@/lib/nav-config';
import { useAuthStore } from '@/store/auth.store';
import { ORDER_STYLES, OrderStatusBadge, PaymentStatusBadge, WarningChip } from './badges';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';
import {
  formatLagosDateTime,
  formatNaira,
  fulfilmentTargets,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_OPTIONS,
  orderWarnings,
  PAYMENT_STATUS_OPTIONS,
  paymentDeadline,
} from '@/lib/storefront-orders/format';
import { MAX_SEARCH_LENGTH, ORDERS_PAGE_SIZE } from '@/lib/storefront-orders/orders-api';
import type { AdminOrderRow, AdminOrderStatus, AdminPaymentStatus, FulfilmentTarget, ListMeta } from '@/types/storefront-orders';

const SEARCH_DEBOUNCE_MS = 350;
const STAFF_STEPS: FulfilmentTarget[] = ['processing', 'dispatched', 'completed'];
const HEADERS = ['Order', 'Customer', 'Placed', 'Total', 'Payment', 'Status'];

const field = 'px-3.5 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20';

export default function OrdersList() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminOrderStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<AdminPaymentStatus | ''>('');
  const [needsReview, setNeedsReview] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const role = useAuthStore((s) => s.user?.role);
  const canFulfil = canManageOnlineOrders(role);
  const [pending, setPending] = useState<{ order: AdminOrderRow; target: FulfilmentTarget } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyStatus = async () => {
    if (!pending) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await storefrontOrdersService.updateFulfilment(pending.order.orderNumber, pending.target);
      setOrders((rows) => rows.map((r) => (r.orderNumber === updated.orderNumber ? { ...r, status: updated.status } : r)));
      setPending(null);
    } catch (err) {
      setSaveError(explainProblem(describeApiError(err), 'save'));
    } finally {
      setSaving(false);
    }
  };

  const appliedSearch = useRef('');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === appliedSearch.current) return;
      appliedSearch.current = next;
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Ignore responses from superseded requests.
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await storefrontOrdersService.list({ page, limit: ORDERS_PAGE_SIZE, search, status, paymentStatus, needsReview, fromDate, toDate });
      if (id !== requestId.current) return;
      setOrders(result.data);
      setMeta(result.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(explainProblem(describeApiError(err), 'load'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [page, search, status, paymentStatus, needsReview, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = search !== '' || status !== '' || paymentStatus !== '' || needsReview || fromDate !== '' || toDate !== '';
  const reset = () => {
    setSearchInput('');
    appliedSearch.current = '';
    setSearch('');
    setStatus('');
    setPaymentStatus('');
    setNeedsReview(false);
    setFromDate('');
    setToDate('');
    setPage(1);
  };
  const changed = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };
  const dateOrderError = fromDate && toDate && fromDate > toDate ? 'The start date is after the end date.' : null;
  const now = new Date();

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Online orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Orders placed on the online store. This is a separate sales channel: in-store sales and inventory are not affected by anything on this page.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[14rem] max-w-xs">
            <Search size={15} className="absolute left-3 bottom-3 text-gray-400" aria-hidden="true" />
            <label htmlFor="order-search" className="sr-only">Search by order number</label>
            <input
              id="order-search"
              type="search"
              value={searchInput}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search order number"
              className={`${field} w-full pl-9`}
            />
          </div>
          <div>
            <label htmlFor="order-status" className="sr-only">Order status</label>
            <select id="order-status" value={status} onChange={(e) => changed(setStatus)(e.target.value as AdminOrderStatus | '')} className={field}>
              {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="payment-status" className="sr-only">Payment status</label>
            <select id="payment-status" value={paymentStatus} onChange={(e) => changed(setPaymentStatus)(e.target.value as AdminPaymentStatus | '')} className={field}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="from-date" className="block text-[11px] text-gray-400">From (Lagos)</label>
            <input id="from-date" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => changed(setFromDate)(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="to-date" className="block text-[11px] text-gray-400">To (Lagos)</label>
            <input id="to-date" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => changed(setToDate)(e.target.value)} className={field} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
            <input type="checkbox" checked={needsReview} onChange={(e) => changed(setNeedsReview)(e.target.checked)} />
            Needs review
          </label>
          {filtered && (
            <button type="button" onClick={reset} className="pb-2 text-sm text-[#1a7a4a] hover:underline">Clear filters</button>
          )}
        </div>
        {dateOrderError && <p role="alert" className="px-6 pt-3 text-sm text-red-600">{dateOrderError}</p>}

        {error ? (
          <div role="alert" className="flex flex-col items-center text-center py-16 px-6">
            <AlertCircle size={28} className="text-red-400 mb-3" />
            <p className="text-sm font-medium text-gray-800">Could not load online orders</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto" aria-busy={isLoading}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} widths={[110, 150, 120, 80, 80, 110]} />)
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={HEADERS.length}>
                      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-4">
                          <ShoppingBag size={26} className="text-[#1a7a4a]" />
                        </div>
                        <p className="text-sm font-medium text-gray-800">{filtered ? 'No orders match these filters.' : 'No online orders yet.'}</p>
                        {filtered && <button type="button" onClick={reset} className="text-sm text-[#1a7a4a] mt-1 hover:underline">Clear filters</button>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const deadline = paymentDeadline(o, now);
                    const warnings = orderWarnings(o, now);
                    return (
                      <tr key={o.orderNumber} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors align-top">
                        <td className="px-3 py-4 pl-5">
                          <Link href={`/storefront-orders/${encodeURIComponent(o.orderNumber)}`} className="text-sm font-semibold text-gray-900 hover:text-[#1a7a4a] hover:underline">
                            {o.orderNumber}
                          </Link>
                          {warnings.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{warnings.map((w) => <WarningChip key={w.key} warning={w} />)}</div>}
                        </td>
                        <td className="px-3 py-4 text-sm max-w-[11rem]">
                          <span className="block truncate font-medium text-gray-900" title={o.customerName}>{o.customerName}</span>
                          <span className="block truncate text-xs text-gray-400" title={o.customerEmail ?? undefined}>{o.customerEmail ?? 'no email'}</span>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">{formatLagosDateTime(o.createdAt)}</td>
                        <td className="px-3 py-4 text-sm whitespace-nowrap">
                          <span className="font-medium text-gray-900">{formatNaira(o.total)}</span>
                          <span className="block text-xs text-gray-400" data-testid="item-count">{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span>
                        </td>
                        <td className="px-3 py-4"><PaymentStatusBadge status={o.paymentStatus} /></td>
                        <td className="px-3 py-4 pr-5 whitespace-nowrap">
                          {canFulfil && fulfilmentTargets(o).length > 0 ? (
                            <select
                              aria-label={`Status of ${o.orderNumber}`}
                              value={o.status}
                              onChange={(e) => { setSaveError(null); setPending({ order: o, target: e.target.value as FulfilmentTarget }); }}
                              className={`px-2.5 py-1.5 text-xs font-semibold border rounded-full outline-none cursor-pointer ${ORDER_STYLES[o.status]}`}
                            >
                              {o.status === 'confirmed' && <option value="confirmed" disabled>{ORDER_STATUS_LABEL.confirmed}</option>}
                              {STAFF_STEPS.map((t) => <option key={t} value={t} disabled={t !== o.status && !fulfilmentTargets(o).includes(t)}>{ORDER_STATUS_LABEL[t]}</option>)}
                            </select>
                          ) : (
                            <OrderStatusBadge status={o.status} />
                          )}
                          {deadline && (
                            <span className={`mt-1 block text-[11px] ${deadline.overdue ? 'font-medium text-red-600' : 'text-gray-500'}`} data-testid="pay-by">
                              {deadline.overdue ? 'Overdue since' : 'Pay by'} {deadline.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && !error && (
          <nav aria-label="Order pages" className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-sm text-gray-600">
            <span>{meta.total.toLocaleString('en-NG')} orders</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft size={14} /> Previous
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button type="button" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </nav>
        )}
      </div>

      <ActionDialog
        open={pending !== null}
        title={pending ? `Change status to ${ORDER_STATUS_LABEL[pending.target]}` : ''}
        description={pending ? `Move ${pending.order.orderNumber} to "${ORDER_STATUS_LABEL[pending.target]}"? The customer sees the new status and is emailed. This cannot be undone.` : ''}
        confirmLabel="Confirm"
        busyLabel="Saving…"
        isLoading={saving}
        error={saveError}
        onClose={() => setPending(null)}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}
