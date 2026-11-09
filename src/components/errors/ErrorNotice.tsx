import { AlertCircle } from 'lucide-react';
import type { AppError } from '@/lib/errors/app-error';

/**
 * A compact inline error for dialogs and forms: the operation failed, the dialog stays open with what the person
 * entered, and this says why. Pass an `AppError` (its message is already safe to show) or a safe string.
 */
export default function ErrorNotice({ error }: { error: AppError | string }) {
  const message = typeof error === 'string' ? error : error.message;
  const reference = typeof error === 'string' ? null : error.correlationId;
  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-[#e4b4ae] bg-[#fdf1ef] px-3.5 py-3 text-base text-[#8a2a1d]">
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {message}
        {reference && <span className="mt-1 block text-sm">Reference: {reference}</span>}
      </span>
    </div>
  );
}
