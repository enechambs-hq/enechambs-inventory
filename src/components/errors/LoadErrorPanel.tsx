'use client';

import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { type AppError } from '@/lib/errors/app-error';
import { panelModel } from '@/lib/errors/panel-model';

interface Props {
  error: AppError;
  /** Re-runs the failed READ. The owning page supplies it; this component never makes a request itself. */
  onRetry?: () => void;
  /** Overrides the heading chosen for the kind of error. */
  title?: string;
  /** Page-specific actions shown after (or instead of) retry, e.g. a "Sign in" or "Back to orders" link. */
  actions?: ReactNode;
  /** Label for the retry button. */
  retryLabel?: string;
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';

/**
 * The page-level state for a load that FAILED. It is not an empty state and never looks like one.
 * It shows a plain heading and sentence, an optional support reference and, only when the error says retrying is safe
 * and the page supplied a handler, a "Try again" button. It shows no status code, stack or backend text: it prints only
 * what an `AppError` already declares safe to show.
 */
export default function LoadErrorPanel({ error, onRetry, title, actions, retryLabel = 'Try again' }: Props) {
  const model = panelModel(error, { title, hasRetryHandler: typeof onRetry === 'function' });
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-[#eadfc8] bg-white px-6 py-12 text-center">
      <AlertCircle size={28} className="mb-3 text-[#8a2a1d]" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-[#1d2a22]">{model.title}</h2>
      <p className="mt-1 max-w-md text-base text-[#3b3a33]">{model.message}</p>
      {error.details && error.details.length > 1 && (
        <ul className="mt-2 max-w-md list-disc space-y-1 pl-5 text-left text-sm text-[#3b3a33]">
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {model.reference && <p className="mt-3 break-all text-sm text-[#5d5645]">{model.reference}</p>}
      {(model.showRetry || actions) && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {model.showRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f4f2d] px-5 text-base font-bold text-white transition hover:bg-[#14693f] ${focus}`}
            >
              {retryLabel}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
