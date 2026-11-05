'use client';

import { useState } from 'react';
import { isTrustedCheckoutUrl } from '@/lib/storefront/redirects';
import { parseCheckoutUrl, parseCustomerOrder, type CustomerOrder } from '@/lib/storefront/orders';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { btnPrimary, btnSecondary, Notice } from './ui';

/** Starts (or resumes) the hosted checkout for an order and navigates to it. */
export async function startPayment(orderNumber: string): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const r = await storeRequest({ path: `storefront/orders/${orderNumber}/pay`, method: 'POST', body: {}, parse: parseCheckoutUrl });
  if (!r.ok) return { ok: false, message: friendlyMessage(r), code: r.code };
  if (!isTrustedCheckoutUrl(r.data)) return { ok: false, message: 'We received an unexpected payment address, so we did not open it. Please try again.' };
  window.location.assign(r.data);
  return { ok: true };
}

/** Pay / cancel for one order. `onChange` receives a refreshed order after a cancel. */
export default function OrderActions({ order, onChange }: { order: CustomerOrder; onChange: (o: CustomerOrder) => void }) {
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function pay() {
    setBusy('pay');
    setError(null);
    const r = await startPayment(order.orderNumber);
    if (!r.ok) {
      setBusy(null);
      setError(r.message);
    }
  }

  async function cancel() {
    setBusy('cancel');
    setError(null);
    const r = await storeRequest({ path: `storefront/orders/${order.orderNumber}/cancel`, method: 'POST', body: {}, parse: parseCustomerOrder });
    setBusy(null);
    setConfirming(false);
    if (!r.ok) return setError(friendlyMessage(r));
    onChange(r.data);
  }

  if (!order.canPay && !order.canCancel) return null;
  return (
    <div className="space-y-3">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        {order.canPay && (
          <button type="button" className={btnPrimary} disabled={busy !== null} onClick={pay}>
            {busy === 'pay' ? 'Opening payment…' : order.paymentState === 'failed' ? 'Try payment again' : 'Pay now'}
          </button>
        )}
        {order.canCancel && !confirming && (
          <button type="button" className={btnSecondary} disabled={busy !== null} onClick={() => setConfirming(true)}>
            Cancel order
          </button>
        )}
        {confirming && (
          <span className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Confirm cancellation">
            Cancel this order?
            <button type="button" className={btnSecondary} disabled={busy !== null} onClick={cancel}>
              {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button type="button" className="text-[#5d5645] underline" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </span>
        )}
      </div>
      {order.canPay && order.expiresAt && (
        <p className="text-xs text-[#8b7f6b]">Please pay before {new Date(order.expiresAt).toLocaleTimeString('en-NG', { timeStyle: 'short' })}, or the items return to the shelf.</p>
      )}
    </div>
  );
}
