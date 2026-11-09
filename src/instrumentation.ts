import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config');
}

/** Unhandled errors from server rendering and route handlers. (Expected failures are returned as responses, not thrown.) */
export const onRequestError = Sentry.captureRequestError;
