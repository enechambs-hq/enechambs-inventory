'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import ActionDialog from '@/components/promotions/ActionDialog';
import { OrderStatusBadge, PaymentRecordBadge, PaymentStatusBadge } from './badges';
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


function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex gap-3 py-1 text-sm">
    <dt className="w-32 shrink-0 text-gray-400">{label}</dt>
    <dd className="min-w-0 break-words text-gray-800">{children}</dd>
  </div>
);

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

  if (isLoading && !order) {
    return <div className="p-6 text-sm text-gray-500" role="status" aria-busy="true">Loading order…</div>;
  }
  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f0f2f0] p-6">
        <div role="alert" className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-800">Could not load this order</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]"><RefreshCw size={14} /> Try again</button>
            <Link href="/storefront-orders" className="px-4 py-2 text-sm text-gray-600 hover:underline">Back to online orders</Link>
          </div>
        </div>
      </div>
    );
  }

  const targets = canFulfil ? fulfilmentTargets(order) : [];
  const awaitingLate = awaitsLatePaymentDecision(order);
  const refundable = refundablePayments(order);
  const hasOpenDecision = awaitingLate || refundable.length > 0 || order.paymentStatus === 'review';

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <Link href="/storefront-orders" className="inline-flex items-center gap-1.5 text-sm text-[#1a7a4a] hover:underline mb-4"><ArrowLeft size={14} /> Online orders</Link>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="order-number">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
        <button type="button" onClick={() => void load()} aria-label="Reload order" className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {notice && <p role="status" className="mb-4 rounded-lg border border-[#b9e0c9] bg-[#e8f5ee] px-4 py-2.5 text-sm text-[#14693f]">{notice}</p>}

      {order.reviewReason && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold flex items-center gap-2"><ShieldAlert size={16} aria-hidden="true" /> {REVIEW_REASON_LABEL[order.reviewReason]}: this order needs an administrator’s decision.</p>
          <p className="mt-1 text-red-700">
            {order.reviewReason === 'late_payment' && 'The customer paid after the payment window ended and the stock was returned to the shelf. Honouring it re-reserves the stock; otherwise record a refund.'}
            {order.reviewReason === 'duplicate_charge' && 'The customer was charged more than once for this order. Record a refund decision for the extra charge.'}
            {order.reviewReason === 'payment_mismatch' && 'The verified amount or currency did not match the order, so the money was held and not credited.'}
          </p>
          {!canDecide && <p className="mt-2 font-medium">Only an administrator can decide this. You can see the status but cannot change it.</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Items">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th scope="col" className="py-2 font-semibold">Product (as sold)</th><th scope="col" className="py-2 text-right font-semibold">Qty</th><th scope="col" className="py-2 text-right font-semibold">Unit price</th><th scope="col" className="py-2 text-right font-semibold">Line total</th>
                </tr></thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.comboSlug} className="border-b border-gray-50">
                      <td className="py-2.5">{i.comboName}<span className="block text-xs text-gray-400">/{i.comboSlug}</span></td>
                      <td className="py-2.5 text-right">{i.quantity}</td>
                      <td className="py-2.5 text-right whitespace-nowrap">{formatNaira(i.unitPrice)}</td>
                      <td className="py-2.5 text-right whitespace-nowrap font-medium">{formatNaira(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="pt-3 text-right text-gray-500">Subtotal</td><td className="pt-3 text-right whitespace-nowrap">{formatNaira(order.subtotal)}</td></tr>
                  {order.fulfilment.method === 'delivery' && (
                    <tr><td colSpan={3} className="pt-1 text-right text-gray-500">Delivery fee</td><td className="pt-1 text-right whitespace-nowrap" data-testid="order-delivery-fee">{formatNaira(Number(order.fulfilment.deliveryFee ?? 0))}</td></tr>
                  )}
                  <tr><td colSpan={3} className="pt-1 text-right font-semibold">Total</td><td className="pt-1 text-right whitespace-nowrap text-base font-bold text-[#14693f]" data-testid="order-total">{formatNaira(order.total)}</td></tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-400">Names and prices are the snapshot taken when the order was placed. They do not change if the combo is edited later.</p>
          </Section>

          <Section title="Payments">
            {order.payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payment has been started for this order.</p>
            ) : (
              <ul className="space-y-4">
                {order.payments.map((p) => {
                  const verified = p.capturedAt !== null && p.verifiedAmount !== null;
                  return (
                    <li key={p.id} className="rounded-xl border border-gray-100 p-4" data-testid="payment-record">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <PaymentRecordBadge status={p.status} />
                        {p.reconciliation && <span className="inline-flex px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">{RECONCILIATION_LABEL[p.reconciliation] ?? p.reconciliation}</span>}
                        <span className="ml-auto text-sm font-semibold">{formatNaira(p.amount)}</span>
                      </div>
                      <dl>
                        <Row label="Reference">{p.txRef}</Row>
                        <Row label="Verification">
                          {verified
                            ? <>Verified with Flutterwave: {formatNaira(p.verifiedAmount ?? 0)} {p.verifiedCurrency}{p.providerTransactionId ? ` (transaction ${p.providerTransactionId})` : ''}</>
                            : <span className="text-gray-500">{p.status === 'initiated' ? 'Not paid yet (waiting for verification)' : 'Not verified'}</span>}
                        </Row>
                        <Row label="Captured">{formatLagosDateTime(p.capturedAt)}</Row>
                        {p.refundedAt && <Row label="Refund recorded">{formatLagosDateTime(p.refundedAt)}</Row>}
                        {p.resolutionNote && <Row label="Decision note">{p.resolutionNote}</Row>}
                      </dl>
                      {canDecide && refundable.some((r) => r.id === p.id) && (
                        <button type="button" onClick={() => { setActionError(null); setDecision({ kind: 'refund', payment: p }); }} className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
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
                <summary className="cursor-pointer text-gray-500">Payment checks ({order.paymentEvents.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {order.paymentEvents.map((e, i) => <li key={i}>{formatLagosDateTime(e.createdAt)} · {e.source}{e.eventType ? ` (${e.eventType})` : ''} → {e.outcome}</li>)}
                </ul>
              </details>
            )}
          </Section>

          <Section title="Timeline">
            <ol className="space-y-3 border-l-2 border-gray-100 pl-4">
              {order.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-gray-800">{HISTORY_EVENT_LABEL[h.event] ?? h.event}</span>
                  <span className="ml-2 text-xs text-gray-400">{formatLagosDateTime(h.createdAt)} · {h.actorType === 'staff' ? 'staff' : h.actorType}</span>
                  {h.note && <p className="text-xs text-gray-500 mt-0.5">“{h.note}”</p>}
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Customer">
            <dl>
              <Row label="Name">{order.customer.name}</Row>
              <Row label="Phone">{order.customer.phone}</Row>
              <Row label="Email">{order.customer.email ?? '—'}</Row>
              {order.fulfilment.note && <Row label="Order note">{order.fulfilment.note}</Row>}
            </dl>
          </Section>

          {(order.fulfilment.method === 'delivery' || order.fulfilment.method === 'pickup') && (
            <Section title={order.fulfilment.method === 'delivery' ? 'Delivery' : 'Pickup'}>
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

          <Section title="Order timing">
            <dl>
              <Row label="Placed">{formatLagosDateTime(order.createdAt)}</Row>
              <Row label="Pay by">{formatLagosDateTime(order.expiresAt)}</Row>
              <Row label="Paid">{formatLagosDateTime(order.paidAt)}</Row>
              <Row label="Stock">{order.stockRestoredAt ? `Returned to shelf ${formatLagosDateTime(order.stockRestoredAt)}` : 'Reserved for this order'}</Row>
            </dl>
          </Section>

          {canFulfil && (
            <Section title="Fulfilment">
              {targets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {targets.map((t) => (
                    <button key={t} type="button" onClick={() => { setActionError(null); setPendingTarget(t); }} className="rounded-lg bg-[#1a7a4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c37]">
                      {fulfilmentAction(t, order.fulfilment.method).label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {order.paymentStatus !== 'paid' ? 'Fulfilment starts once the payment is verified. Staff cannot mark an order paid.' : 'No further fulfilment steps for this order.'}
                </p>
              )}
            </Section>
          )}

          {hasOpenDecision && (
            <Section title="Payment decisions">
              {canDecide ? (
                awaitingLate ? (
                  <button type="button" onClick={() => { setActionError(null); setDecision({ kind: 'honour' }); }} className="rounded-lg bg-[#1a7a4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c37]">
                    Honour late payment
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">Use “Record refund decision” on the payment above where a refund is due.</p>
                )
              ) : (
                <p className="text-sm text-gray-500">Honouring a late payment and recording refunds are administrator decisions. Ask an administrator.</p>
              )}
            </Section>
          )}
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
