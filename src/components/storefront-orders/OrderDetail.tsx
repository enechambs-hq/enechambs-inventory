'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import ActionDialog from '@/components/promotions/ActionDialog';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import { LabelledBadge, OrderStatusBadge, PaymentRecordBadge, PaymentStatusBadge } from './badges';
import ReasonDialog from './ReasonDialog';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { canDecideStorefrontPayments, canManageOnlineOrders } from '@/lib/nav-config';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';
import {
  awaitsLatePaymentDecision,
  formatLagosDateTime,
  formatNaira,
  fulfilmentAction,
  fulfilmentTargets,
  HISTORY_EVENT_LABEL,
  RECONCILIATION_LABEL,
  refundablePayments,
  REVIEW_REASON_LABEL,
} from '@/lib/storefront-orders/format';
import { useAuthStore } from '@/store/auth.store';
import type { AdminOrderDetail, AdminPayment, FulfilmentTarget } from '@/types/storefront-orders';


function Section({ title, children, aside, className = '' }: { title: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:gap-3">
    <dt className="shrink-0 text-gray-600 sm:w-32">{label}</dt>
    <dd className="min-w-0 break-words text-gray-900 [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1a7a4a] px-5 text-sm font-medium text-white hover:bg-[#145c37]';

type Decision = { kind: 'honour' } | { kind: 'refund'; payment: AdminPayment } | null;

export default function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const canFulfil = canManageOnlineOrders(role);
  const canDecide = canDecideStorefrontPayments(role);

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingTarget, setPendingTarget] = useState<FulfilmentTarget | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await storefrontOrdersService.get(orderNumber);
      if (id !== requestId.current) return;
      setOrder(result);
    } catch (err) {
      if (id !== requestId.current) return;
      const problem = describeApiError(err);
      setError(problem.status === 404 ? 'This order does not exist.' : explainProblem(problem, 'load'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs a backend action and shows what the BACKEND says happened: no optimistic update. */
  async function run(action: () => Promise<AdminOrderDetail>, success: string, close: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await action();
      setOrder(updated);
      setNotice(success);
      close();
    } catch (err) {
      setActionError(explainProblem(describeApiError(err), 'save'));
    } finally {
      setBusy(false);
    }
  }

  const phone = useMediaQuery('(max-width: 639px)');

  if (isLoading && !order) {
    return <div className="mx-auto w-full max-w-[80rem] text-sm text-gray-600" role="status" aria-busy="true">Loading order…</div>;
  }
  if (error || !order) {
    return (
      <div className="mx-auto w-full max-w-[80rem]">
        <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-8">
          <AlertCircle size={28} className="mx-auto mb-3 text-red-400" />
          <p className="text-base font-medium text-gray-800">Could not load this order</p>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#b9e0c9] px-4 text-sm font-medium text-[#1a7a4a] hover:bg-[#e8f5ee]"><RefreshCw size={14} /> Try again</button>
            <Link href="/storefront-orders" className="inline-flex min-h-11 items-center px-4 text-sm text-[#1a7a4a] hover:underline">Back to online orders</Link>
          </div>
        </div>
      </div>
    );
  }

  const targets = canFulfil ? fulfilmentTargets(order) : [];
  const awaitingLate = awaitsLatePaymentDecision(order);
  const refundable = refundablePayments(order);
  const hasOpenDecision = awaitingLate || refundable.length > 0 || order.paymentStatus === 'review';

  const nextAction = canFulfil && (
    <Section title="Fulfilment" className="order-2">
      {targets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <button key={t} type="button" onClick={() => { setActionError(null); setPendingTarget(t); }} className={primaryButton}>
              {fulfilmentAction(t, order.fulfilment.method).label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-700">
          {order.paymentStatus !== 'paid' ? 'Fulfilment starts once the payment is verified. Staff cannot mark an order paid.' : 'No further fulfilment steps for this order.'}
        </p>
      )}
    </Section>
  );

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <Link href="/storefront-orders" className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#1a7a4a] hover:underline"><ArrowLeft size={16} /> Online orders</Link>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-all text-[28px] font-bold leading-tight tracking-tight text-[#0f4f2d] md:text-[32px]" data-testid="order-number">{order.orderNumber}</h1>
          <button type="button" onClick={() => void load()} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50">
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 xl:hidden">
          <LabelledBadge label="Order"><OrderStatusBadge status={order.status} /></LabelledBadge>
          <LabelledBadge label="Payment"><PaymentStatusBadge status={order.paymentStatus} /></LabelledBadge>
        </div>
      </div>

      {notice && <p role="status" className="mb-4 rounded-lg border border-[#b9e0c9] bg-[#e8f5ee] px-4 py-3 text-sm text-[#14693f]">{notice}</p>}

      {order.reviewReason && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-start gap-2 font-semibold"><ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{REVIEW_REASON_LABEL[order.reviewReason]}: this order needs an administrator’s decision.</span></p>
          <p className="mt-1 text-red-700">
            {order.reviewReason === 'late_payment' && 'The customer paid after the payment window ended and the stock was returned to the shelf. Honouring it re-reserves the stock; otherwise record a refund.'}
            {order.reviewReason === 'duplicate_charge' && 'The customer was charged more than once for this order. Record a refund decision for the extra charge.'}
            {order.reviewReason === 'payment_mismatch' && 'The verified amount or currency did not match the order, so the money was held and not credited.'}
          </p>
          {!canDecide && <p className="mt-2 font-medium">Only an administrator can decide this. You can see the status but cannot change it.</p>}
        </div>
      )}

      {/* One column below 1280px, in this reading order; two columns from 1280px (actions and facts on the right). */}
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="contents xl:col-start-2 xl:row-start-1 xl:flex xl:flex-col xl:gap-5">
          <Section title="Status" className="hidden xl:block">
            <div className="flex flex-col gap-2">
              <LabelledBadge label="Order"><OrderStatusBadge status={order.status} /></LabelledBadge>
              <LabelledBadge label="Payment"><PaymentStatusBadge status={order.paymentStatus} /></LabelledBadge>
            </div>
          </Section>
          {nextAction}
          {hasOpenDecision && (
            <Section title="Payment decisions" className="order-3">
              {canDecide ? (
                awaitingLate ? (
                  <button type="button" onClick={() => { setActionError(null); setDecision({ kind: 'honour' }); }} className={primaryButton}>
                    Honour late payment
                  </button>
                ) : (
                  <p className="text-sm text-gray-700">Use “Record refund decision” on the payment above where a refund is due.</p>
                )
              ) : (
                <p className="text-sm text-gray-700">Honouring a late payment and recording refunds are administrator decisions. Ask an administrator.</p>
              )}
            </Section>
          )}
        </div>

        <div className="contents xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:flex xl:flex-col xl:gap-5">
          <Section title="Items" className="order-4">
            {phone ? (
              <div>
                <ul className="divide-y divide-gray-100">
                  {order.items.map((i) => (
                    <li key={i.comboSlug} className="py-3 first:pt-0">
                      <p className="text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">{i.comboName}</p>
                      <p className="text-sm text-gray-600 [overflow-wrap:anywhere]">/{i.comboSlug}</p>
                      <p className="mt-1 flex items-baseline justify-between gap-3 text-sm text-gray-700">
                        <span>{i.quantity} × {formatNaira(i.unitPrice)}</span>
                        <span className="font-medium text-gray-900">{formatNaira(i.lineTotal)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                <dl className="mt-1 space-y-1 border-t border-gray-100 pt-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-600">Subtotal</dt><dd>{formatNaira(order.subtotal)}</dd></div>
                  {order.fulfilment.method === 'delivery' && (
                    <div className="flex justify-between gap-3"><dt className="text-gray-600">Delivery fee</dt><dd data-testid="order-delivery-fee">{formatNaira(Number(order.fulfilment.deliveryFee ?? 0))}</dd></div>
                  )}
                  <div className="flex justify-between gap-3"><dt className="font-semibold">Total</dt><dd className="text-base font-bold text-[#14693f]" data-testid="order-total">{formatNaira(order.total)}</dd></div>
                </dl>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                    <th scope="col" className="py-2 font-semibold">Product (as sold)</th><th scope="col" className="py-2 text-right font-semibold">Qty</th><th scope="col" className="py-2 text-right font-semibold">Unit price</th><th scope="col" className="py-2 text-right font-semibold">Line total</th>
                  </tr></thead>
                  <tbody>
                    {order.items.map((i) => (
                      <tr key={i.comboSlug} className="border-b border-gray-100">
                        <td className="py-3">{i.comboName}<span className="block text-sm text-gray-600">/{i.comboSlug}</span></td>
                        <td className="py-3 text-right">{i.quantity}</td>
                        <td className="whitespace-nowrap py-3 text-right">{formatNaira(i.unitPrice)}</td>
                        <td className="whitespace-nowrap py-3 text-right font-medium">{formatNaira(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={3} className="pt-3 text-right text-gray-600">Subtotal</td><td className="whitespace-nowrap pt-3 text-right">{formatNaira(order.subtotal)}</td></tr>
                    {order.fulfilment.method === 'delivery' && (
                      <tr><td colSpan={3} className="pt-1 text-right text-gray-600">Delivery fee</td><td className="whitespace-nowrap pt-1 text-right" data-testid="order-delivery-fee">{formatNaira(Number(order.fulfilment.deliveryFee ?? 0))}</td></tr>
                    )}
                    <tr><td colSpan={3} className="pt-1 text-right font-semibold">Total</td><td className="whitespace-nowrap pt-1 text-right text-base font-bold text-[#14693f]" data-testid="order-total">{formatNaira(order.total)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-3 text-sm text-gray-600">Names and prices are the snapshot taken when the order was placed. They do not change if the combo is edited later.</p>
          </Section>

          <Section title="Payments" className="order-7">
            {order.payments.length === 0 ? (
              <p className="text-sm text-gray-700">No payment has been started for this order.</p>
            ) : (
              <ul className="space-y-4">
                {order.payments.map((p) => {
                  const verified = p.capturedAt !== null && p.verifiedAmount !== null;
                  return (
                    <li key={p.id} className="rounded-xl border border-gray-200 p-4" data-testid="payment-record">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <PaymentRecordBadge status={p.status} />
                        {p.reconciliation && <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{RECONCILIATION_LABEL[p.reconciliation] ?? p.reconciliation}</span>}
                        <span className="ml-auto text-sm font-semibold">{formatNaira(p.amount)}</span>
                      </div>
                      <dl>
                        <Row label="Reference">{p.txRef}</Row>
                        <Row label="Verification">
                          {verified
                            ? <>Verified with Flutterwave: {formatNaira(p.verifiedAmount ?? 0)} {p.verifiedCurrency}{p.providerTransactionId ? ` (transaction ${p.providerTransactionId})` : ''}</>
                            : <span className="text-gray-600">{p.status === 'initiated' ? 'Not paid yet (waiting for verification)' : 'Not verified'}</span>}
                        </Row>
                        <Row label="Captured">{formatLagosDateTime(p.capturedAt)}</Row>
                        {p.refundedAt && <Row label="Refund recorded">{formatLagosDateTime(p.refundedAt)}</Row>}
                        {p.resolutionNote && <Row label="Decision note">{p.resolutionNote}</Row>}
                      </dl>
                      {canDecide && refundable.some((r) => r.id === p.id) && (
                        <button type="button" onClick={() => { setActionError(null); setDecision({ kind: 'refund', payment: p }); }} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50">
                          Record refund decision
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {order.paymentEvents.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center text-gray-700">Payment checks ({order.paymentEvents.length})</summary>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {order.paymentEvents.map((e, i) => <li key={i}>{formatLagosDateTime(e.createdAt)} · {e.source}{e.eventType ? ` (${e.eventType})` : ''} → {e.outcome}</li>)}
                </ul>
              </details>
            )}
          </Section>

          <Section title="Timeline" className="order-9">
            <ol className="space-y-3 border-l-2 border-gray-200 pl-4">
              {order.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-gray-900">{HISTORY_EVENT_LABEL[h.event] ?? h.event}</span>
                  <span className="ml-2 text-sm text-gray-600">{formatLagosDateTime(h.createdAt)} · {h.actorType === 'staff' ? 'staff' : h.actorType}</span>
                  {h.note && <p className="mt-0.5 text-sm text-gray-700">“{h.note}”</p>}
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="contents xl:col-start-2 xl:row-start-2 xl:flex xl:flex-col xl:gap-5">
          <Section title="Customer" className="order-5">
            <dl>
              <Row label="Name">{order.customer.name}</Row>
              <Row label="Phone">{order.customer.phone}</Row>
              <Row label="Email">{order.customer.email ?? '—'}</Row>
              {order.fulfilment.note && <Row label="Order note">{order.fulfilment.note}</Row>}
            </dl>
          </Section>

          {(order.fulfilment.method === 'delivery' || order.fulfilment.method === 'pickup') && (
            <Section title={order.fulfilment.method === 'delivery' ? 'Delivery' : 'Pickup'} className="order-6">
              {order.fulfilment.method === 'delivery' && order.fulfilment.address ? (
                <dl>
                  <Row label="Deliver to">{order.fulfilment.address.recipientName}</Row>
                  <Row label="Phone">{order.fulfilment.address.recipientPhone}</Row>
                  <Row label="Address">{[order.fulfilment.address.addressLine, order.fulfilment.address.city, order.fulfilment.address.state].filter(Boolean).join(', ')}</Row>
                </dl>
              ) : (
                <dl>
                  <Row label="Collect from">{order.fulfilment.pickup?.address ?? 'Store'}</Row>
                  {order.fulfilment.pickup && <Row label="Hours">{order.fulfilment.pickup.hours}</Row>}
                </dl>
              )}
            </Section>
          )}

          <Section title="Order timing" className="order-8">
            <dl>
              <Row label="Placed">{formatLagosDateTime(order.createdAt)}</Row>
              <Row label="Pay by">{formatLagosDateTime(order.expiresAt)}</Row>
              <Row label="Paid">{formatLagosDateTime(order.paidAt)}</Row>
              <Row label="Stock">{order.stockRestoredAt ? `Returned to shelf ${formatLagosDateTime(order.stockRestoredAt)}` : 'Reserved for this order'}</Row>
            </dl>
          </Section>
        </div>
      </div>

      <ActionDialog
        open={pendingTarget !== null}
        title={pendingTarget ? fulfilmentAction(pendingTarget, order.fulfilment.method).label : ''}
        description={pendingTarget ? fulfilmentAction(pendingTarget, order.fulfilment.method).question : ''}
        confirmLabel="Confirm"
        busyLabel="Saving…"
        isLoading={busy}
        error={actionError}
        onClose={() => setPendingTarget(null)}
        onConfirm={() => { if (pendingTarget) void run(() => storefrontOrdersService.updateFulfilment(order.orderNumber, pendingTarget), fulfilmentAction(pendingTarget, order.fulfilment.method).done, () => setPendingTarget(null)); }}
      />

      <ReasonDialog
        open={decision !== null}
        title={decision?.kind === 'honour' ? 'Honour this late payment' : 'Record refund decision'}
        description={decision?.kind === 'honour'
          ? 'The stock is reserved again for this order (all or nothing) and the order becomes confirmed. If any item is no longer available nothing changes and you should record a refund instead.'
          : 'This records that the payment is to be refunded and the date of the decision. The money itself is returned from the Flutterwave dashboard. The original capture date is kept.'}
        confirmLabel={decision?.kind === 'honour' ? 'Honour payment' : 'Record refund'}
        busyLabel="Saving…"
        isLoading={busy}
        error={actionError}
        onClose={() => setDecision(null)}
        onConfirm={(reason) => {
          if (!decision) return;
          if (decision.kind === 'honour') void run(() => storefrontOrdersService.honourLatePayment(order.orderNumber, reason), 'Late payment honoured. The order is confirmed.', () => setDecision(null));
          else void run(() => storefrontOrdersService.recordRefund(order.orderNumber, decision.payment.id, reason), 'Refund decision recorded.', () => setDecision(null));
        }}
      />
    </div>
  );
}
