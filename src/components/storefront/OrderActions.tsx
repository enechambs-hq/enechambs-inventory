'use client';

import { useState } from 'react';
import { isTrustedCheckoutUrl } from '@/lib/storefront/redirects';
import { parseCheckoutUrl, parseCustomerOrder, type CustomerOrder } from '@/lib/storefront/orders';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import { makeAppError, type AppError } from '@/lib/errors/app-error';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { Notice } from './ui';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const primaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;
const secondaryClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;

/** Starts (or resumes) the hosted checkout for an order and navigates to it. */
export async function startPayment(orderNumber: string): Promise<{ ok: true } | { ok: false; message: string; code?: string; error: AppError }> {
  const r = await storeRequest({ path: `storefront/orders/${orderNumber}/pay`, method: 'POST', body: {}, parse: parseCheckoutUrl });
  // Starting a payment is a write: the shared model never marks it retryable. The person chooses to press "Try payment again".
  if (!r.ok) return { ok: false, message: friendlyMessage(r), code: r.code, error: appErrorFromStore(r, { method: 'POST', action: 'change', one: 'order' }) };
  if (!isTrustedCheckoutUrl(r.data)) {
    const message = 'We received an unexpected payment address, so we did not open it. Please try again.';
    return { ok: false, message, error: makeAppError({ kind: 'unexpected', message, retryable: false }) };
  }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {order.canPay && (
          <button type="button" className={primaryClass} disabled={busy !== null} onClick={pay}>
            {busy === 'pay' ? 'Opening payment…' : order.paymentState === 'failed' ? 'Try payment again' : 'Pay now'}
          </button>
        )}
        {order.canCancel && !confirming && (
          <button type="button" className={secondaryClass} disabled={busy !== null} onClick={() => setConfirming(true)}>
            Cancel order
          </button>
        )}
      </div>
      {confirming && (
        <div role="group" aria-label="Confirm cancellation" className="rounded-2xl border border-[#d9ccaf] bg-white p-4">
          <p className="text-base font-semibold text-[#1d2a22]">Cancel this order?</p>
          <div className="mt-3 flex flex-col gap-3">
            <button type="button" className={`${secondaryClass} border-[#e4b4ae] text-[#8a2a1d] hover:bg-[#fdf1ef]`} disabled={busy !== null} onClick={cancel}>
              {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel it'}
            </button>
            <button type="button" className={secondaryClass} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {order.canPay && order.expiresAt && (
        <p className="text-sm text-[#5d5645]">Please pay before {new Date(order.expiresAt).toLocaleTimeString('en-NG', { timeStyle: 'short' })}, or the items return to the shelf.</p>
      )}
    </div>
  );
}
