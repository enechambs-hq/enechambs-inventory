'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import ActionDialog from '@/components/promotions/ActionDialog';
import SkeletonRow from '@/components/shared/SkeletonRow';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import { canManageOnlineOrders } from '@/lib/nav-config';
import { useAuthStore } from '@/store/auth.store';
import { LabelledBadge, ORDER_STYLES, OrderStatusBadge, PaymentStatusBadge, WarningChip } from './badges';
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

  const phone = useMediaQuery('(max-width: 767px)');
  const tablet = useMediaQuery('(max-width: 1023px)');

  const input = 'block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20 md:text-sm';
  const label = 'mb-1 block text-sm font-medium text-gray-700';
  const emptyOrError = error ? (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <AlertCircle size={28} className="mb-3 text-red-400" />
      <p className="text-base font-medium text-gray-800">Could not load online orders</p>
      <p className="mt-1 max-w-md text-sm text-gray-600">{error}</p>
      <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#b9e0c9] px-4 text-sm font-medium text-[#1a7a4a] hover:bg-[#e8f5ee]">
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  ) : null;
  const emptyState = (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f5ee]">
        <ShoppingBag size={26} className="text-[#1a7a4a]" />
      </div>
      <p className="text-base font-medium text-gray-800">{filtered ? 'No orders match these filters.' : 'No online orders yet.'}</p>
      {filtered && (
        <button type="button" onClick={reset} className="mt-1 inline-flex min-h-11 items-center px-3 text-sm font-medium text-[#1a7a4a] hover:underline">Clear filters</button>
      )}
    </div>
  );

  /** The next-step control (staff and administrators, only when the order has a next step). Same options and rules as ever. */
  const statusSelect = (o: AdminOrderRow, className: string) => (
    <select
      aria-label={`Status of ${o.orderNumber}`}
      value={o.status}
      onChange={(e) => { setSaveError(null); setPending({ order: o, target: e.target.value as FulfilmentTarget }); }}
      className={className}
    >
      {o.status === 'confirmed' && <option value="confirmed" disabled>{ORDER_STATUS_LABEL.confirmed}</option>}
      {STAFF_STEPS.map((t) => <option key={t} value={t} disabled={t !== o.status && !fulfilmentTargets(o).includes(t)}>{ORDER_STATUS_LABEL[t]}</option>)}
    </select>
  );
  const payBy = (o: AdminOrderRow) => {
    const deadline = paymentDeadline(o, now);
    return deadline ? (
      <span className={`mt-1 block text-sm ${deadline.overdue ? 'font-medium text-red-600' : 'text-gray-600'}`} data-testid="pay-by">
        {deadline.overdue ? 'Overdue since' : 'Pay by'} {deadline.label}
      </span>
    ) : null;
  };
  const warningChips = (o: AdminOrderRow) => {
    const warnings = orderWarnings(o, now);
    return warnings.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{warnings.map((w) => <WarningChip key={w.key} warning={w} />)}</div> : null;
  };

  // Phones: stacked cards. Tablets: five columns (Placed sits under the order number). Desktop: six columns.
  const columns = phone ? [] : tablet ? ['Order', 'Customer', 'Total', 'Payment', 'Status'] : HEADERS;
  const th = 'sticky top-14 z-10 border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 first:rounded-tl-2xl first:pl-5 last:rounded-tr-2xl last:pr-5';

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#0f4f2d] md:text-[32px]">Online orders</h1>
        <p className="mt-1 text-sm text-gray-600">
          Orders placed on the online store. This is a separate sales channel: in-store sales and inventory are not affected by anything on this page.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4">
          <div className="relative col-span-2">
            <label htmlFor="order-search" className={label}>Search by order number</label>
            <Search size={16} className="pointer-events-none absolute bottom-3.5 left-3 text-gray-400" aria-hidden="true" />
            <input
              id="order-search"
              type="search"
              value={searchInput}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search order number"
              className={`${input} pl-9`}
            />
          </div>
          <div className="col-span-2 min-[380px]:col-span-1">
            <label htmlFor="order-status" className={label}>Order status</label>
            <select id="order-status" value={status} onChange={(e) => changed(setStatus)(e.target.value as AdminOrderStatus | '')} className={input}>
              {ORDER_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 min-[380px]:col-span-1">
            <label htmlFor="payment-status" className={label}>Payment status</label>
            <select id="payment-status" value={paymentStatus} onChange={(e) => changed(setPaymentStatus)(e.target.value as AdminPaymentStatus | '')} className={input}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="from-date" className={label}>From (Lagos)</label>
            <input id="from-date" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => changed(setFromDate)(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="to-date" className={label}>To (Lagos)</label>
            <input id="to-date" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => changed(setToDate)(e.target.value)} className={input} />
          </div>
          <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 md:col-span-1 md:self-end">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#1a7a4a]" checked={needsReview} onChange={(e) => changed(setNeedsReview)(e.target.checked)} />
            Needs review
          </label>
          {filtered && (
            <div className="col-span-2 md:col-span-1 md:self-end">
              <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[#1a7a4a] hover:bg-[#e8f5ee]">Clear filters</button>
            </div>
          )}
        </div>
        {dateOrderError && <p role="alert" className="mt-3 text-sm text-red-600">{dateOrderError}</p>}
      </div>

      <div className="mt-4" aria-busy={isLoading}>
        {error ? (
          <div className="rounded-2xl border border-gray-200 bg-white">{emptyOrError}</div>
        ) : phone ? (
          isLoading ? (
            <ul className="space-y-3" aria-label="Loading orders">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex justify-between"><div className="h-5 w-32 animate-pulse rounded-md bg-gray-200" /><div className="h-5 w-16 animate-pulse rounded-md bg-gray-200" /></div>
                  <div className="mt-3 h-4 w-48 animate-pulse rounded-md bg-gray-200" />
                  <div className="mt-3 flex gap-2"><div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" /><div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" /></div>
                </li>
              ))}
            </ul>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white">{emptyState}</div>
          ) : (
            <ul className="space-y-3" aria-label="Online orders">
              {orders.map((o) => (
                <li key={o.orderNumber} className="rounded-2xl border border-gray-200 bg-white">
                  <Link href={`/storefront-orders/${encodeURIComponent(o.orderNumber)}`} className="block rounded-2xl p-4 hover:bg-gray-50">
                    <span className="flex items-start justify-between gap-3">
                      <span className="break-all text-base font-semibold text-[#0f4f2d]">{o.orderNumber}</span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-bold text-gray-900">{formatNaira(o.total)}</span>
                        <span className="block text-sm text-gray-600" data-testid="item-count">{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span>
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-gray-700">
                      <span className="font-medium text-gray-900 [overflow-wrap:anywhere]">{o.customerName}</span>
                      <span className="text-gray-400"> · </span>
                      {formatLagosDateTime(o.createdAt)}
                    </span>
                    <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <LabelledBadge label="Order"><OrderStatusBadge status={o.status} /></LabelledBadge>
                      <LabelledBadge label="Payment"><PaymentStatusBadge status={o.paymentStatus} /></LabelledBadge>
                    </span>
                    {warningChips(o)}
                    {payBy(o)}
                  </Link>
                  {canFulfil && fulfilmentTargets(o).length > 0 && (
                    <div className="border-t border-gray-100 p-4 pt-3">
                      <span aria-hidden="true" className="mb-1 block text-sm font-medium text-gray-700">Update status</span>
                      {statusSelect(o, `block min-h-11 w-full cursor-pointer rounded-lg border bg-white px-3 text-base font-semibold outline-none ${ORDER_STYLES[o.status]}`)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <table className="w-full">
              <thead>
                <tr>
                  {columns.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} widths={tablet ? [110, 140, 70, 70, 100] : [110, 150, 120, 80, 80, 110]} />)
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>{emptyState}</td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.orderNumber} className="min-h-14 border-b border-gray-100 align-top transition-colors last:border-b-0 hover:bg-gray-50">
                      <td className="px-3 py-3.5 pl-5">
                        <Link href={`/storefront-orders/${encodeURIComponent(o.orderNumber)}`} className="inline-flex min-h-6 items-center whitespace-nowrap text-sm font-semibold text-[#0f4f2d] hover:underline">
                          {o.orderNumber}
                        </Link>
                        {tablet && <span className="block text-sm text-gray-600">{formatLagosDateTime(o.createdAt)}</span>}
                        {warningChips(o)}
                      </td>
                      <td className="px-3 py-3.5 text-sm [overflow-wrap:anywhere]">
                        <span className="block font-medium text-gray-900">{o.customerName}</span>
                        <span className="block text-gray-600">{o.customerEmail ?? 'no email'}</span>
                      </td>
                      {!tablet && <td className="px-3 py-3.5 text-sm text-gray-700">{formatLagosDateTime(o.createdAt)}</td>}
                      <td className="whitespace-nowrap px-3 py-3.5 text-sm">
                        <span className="font-medium text-gray-900">{formatNaira(o.total)}</span>
                        <span className="block text-gray-600" data-testid="item-count">{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span>
                      </td>
                      <td className="px-3 py-3.5"><PaymentStatusBadge status={o.paymentStatus} /></td>
                      <td className="px-3 py-3.5 pr-5">
                        {canFulfil && fulfilmentTargets(o).length > 0 ? (
                          statusSelect(o, `min-h-11 cursor-pointer rounded-full border px-3 text-sm font-semibold outline-none ${ORDER_STYLES[o.status]}`)
                        ) : (
                          <OrderStatusBadge status={o.status} />
                        )}
                        {payBy(o)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && !error && (
        <nav aria-label="Order pages" className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:flex sm:justify-between">
          <span className="order-1 sm:order-none">{meta.total.toLocaleString('en-NG')} orders</span>
          <div className="contents sm:flex sm:items-center sm:gap-3">
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)} className="order-3 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 sm:order-none">
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="order-2 text-right sm:order-none">Page {meta.page} of {meta.totalPages}</span>
            <button type="button" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)} className="order-4 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-40 hover:bg-gray-50 sm:order-none">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}

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
