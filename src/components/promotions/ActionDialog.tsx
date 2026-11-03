'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface ActionDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel: string;
  tone?: 'primary' | 'warning';
  isLoading: boolean;
  /** A server error from the attempted action; the dialog stays open so it can be read and retried. */
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for consequential (non-delete) actions, styled like the
 * existing ConfirmDialog. Adds dialog semantics, Escape to close and initial
 * focus on Cancel.
 */
export default function ActionDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  tone = 'primary',
  isLoading,
  error,
  onClose,
  onConfirm,
}: ActionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isLoading, onClose]);

  if (!open) return null;
  const confirmClass =
    tone === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#1a7a4a] hover:bg-[#145c37]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
      >
        <h3 id="action-dialog-title" className="text-base font-semibold text-gray-900 mb-1">
          {title}
        </h3>
        <div className="text-sm text-gray-500 mb-4">{description}</div>
        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 mb-4"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${confirmClass}`}
          >
            {isLoading ? busyLabel : error ? 'Try again' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
