'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { refundReferenceError } from '@/lib/storefront-orders/cancellation';
import { formatNaira } from '@/lib/storefront-orders/format';

interface Props {
  open: boolean;
  /** The full captured amount. Shown read-only; it is never sent and cannot be edited. */
  amount: number | null;
  isLoading: boolean;
  /** A server error from the attempted action; the dialog stays open with the reference still typed. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (refundReference: string) => void;
}

/**
 * Records that the FULL refund has already been made in the Flutterwave
 * dashboard. The reference is mandatory; the amount is display only.
 */
export default function RefundReferenceDialog({ open, amount, isLoading, error, onClose, onConfirm }: Props) {
  const [reference, setReference] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const problem = refundReferenceError(reference);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  if (!open) return null;
  const submit = () => {
    setTouched(true);
    if (!problem && !isLoading) onConfirm(reference.trim());
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title">
      <form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <h2 id="refund-dialog-title" className="text-lg font-semibold text-gray-900">Record the completed refund</h2>
        <p className="mt-2 text-sm text-gray-600">
          Only continue once you have refunded the <strong>full amount</strong> in the Flutterwave dashboard. Recording it cancels the order, marks the payment refunded and returns the stock to the shelf. This cannot be undone.
        </p>
        <dl className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Full refund amount</dt>
            <dd className="font-semibold text-gray-900" data-testid="refund-amount">{amount === null ? '—' : formatNaira(amount)}</dd>
          </div>
        </dl>
        <label htmlFor="refund-reference" className="mt-4 block text-sm font-medium text-gray-700">Flutterwave refund reference</label>
        <input
          id="refund-reference"
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && problem ? true : undefined}
          aria-describedby={touched && problem ? 'refund-reference-error' : undefined}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
        />
        {touched && problem && <p id="refund-reference-error" className="mt-1 text-sm text-red-700">{problem}</p>}
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isLoading} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={isLoading} className="rounded-lg bg-[#1a7a4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c37] disabled:cursor-not-allowed disabled:opacity-50">
            {isLoading ? 'Recording…' : 'Record refund and cancel order'}
          </button>
        </div>
      </form>
    </div>
  );
}
