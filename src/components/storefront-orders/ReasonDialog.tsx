'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export const MIN_REASON = 3;
export const MAX_REASON = 400;

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel: string;
  isLoading: boolean;
  /** A server error from the attempted action; the dialog stays open so it can be read and retried. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Confirmation dialog for the administrator's financial decisions. A written
 * reason is mandatory (the backend refuses a missing or too-short one and
 * records it in the order history and the activity log with the admin's name).
 */
export default function ReasonDialog({ open, title, description, confirmLabel, busyLabel, isLoading, error, onClose, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON && trimmed.length <= MAX_REASON;

  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reason-dialog-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="reason-dialog-title" className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="mt-2 text-sm text-gray-600">{description}</div>
        <label htmlFor="decision-reason" className="mt-4 block text-sm font-medium text-gray-700">
          Reason <span className="font-normal text-gray-400">(required, recorded with your name)</span>
        </label>
        <textarea
          id="decision-reason"
          ref={textRef}
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
        />
        <p className="mt-1 text-xs text-gray-400">{trimmed.length}/{MAX_REASON}</p>
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isLoading} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || isLoading}
            onClick={() => onConfirm(trimmed)}
            className="rounded-lg bg-[#1a7a4a] px-4 py-2 text-sm font-medium text-white hover:bg-[#145c37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
