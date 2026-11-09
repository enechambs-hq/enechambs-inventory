import { ERROR_TITLES, type AppError } from './app-error.ts';

export interface PanelModel {
  title: string;
  message: string;
  /** "Reference: ..." text for support, when the error carries a correlation id. */
  reference: string | null;
  /** Retry is shown only when it is safe (the error says so) AND the page supplied a handler. */
  showRetry: boolean;
}

/** What an error panel displays. Pure, so the rules (no unsafe retry, optional reference) are unit-tested. */
export function panelModel(error: AppError, options: { title?: string; hasRetryHandler: boolean }): PanelModel {
  return {
    title: options.title ?? ERROR_TITLES[error.kind],
    message: error.message,
    reference: error.correlationId ? `Reference: ${error.correlationId}` : null,
    showRetry: error.retryable && options.hasRetryHandler,
  };
}
