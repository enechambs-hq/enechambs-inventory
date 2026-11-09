/**
 * The one error model for the storefront and the staff application.
 *
 * Everything that can fail (an axios call, a customer-API result, a catalogue read, a thrown exception) is turned into an
 * `AppError` by `normalize.ts`. Pages then decide what to show from the KIND, never from raw HTTP details or raw backend
 * text. This module is pure: no React, no axios, no page code, so it can be imported from anywhere without cycles.
 */

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'unexpected';

export const ERROR_KINDS: readonly ErrorKind[] = [
  'network',
  'timeout',
  'unauthenticated',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'rate_limited',
  'unavailable',
  'unexpected',
];

export interface AppError {
  kind: ErrorKind;
  /** HTTP status when there was a response (absent for a network failure or a client-side timeout). */
  status?: number;
  /** The API's machine-readable code when it sent a well-formed one (e.g. INSUFFICIENT_STOCK, UPSTREAM_TIMEOUT). */
  code?: string;
  /** Safe to show to a person. Never a stack, an exception text or a server-side detail. */
  message: string;
  /** True only when repeating the SAME request, by the person's choice, is reasonable and cannot do harm. */
  retryable: boolean;
  /** An identifier support can look up in the logs, when the response carried one. */
  correlationId?: string;
  /** Individual, safe validation messages when the API listed several (never more than a handful). */
  details?: string[];
}

/** Brand marker so an AppError passed through two layers is recognised, not re-normalised. */
const APP_ERROR = Symbol.for('enechambs.AppError');

export function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[APP_ERROR] === true;
}

export function makeAppError(fields: AppError): AppError {
  const error = { ...fields };
  Object.defineProperty(error, APP_ERROR, { value: true, enumerable: false });
  return error;
}

/** What each kind says when nothing more specific (and safe) is available. Deliberately not tied to any one area. */
export const FALLBACK_MESSAGES: Record<ErrorKind, string> = {
  network: 'We could not reach the server. Please check your connection and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  unauthenticated: 'Please sign in to continue.',
  forbidden: 'You do not have permission to do this.',
  not_found: 'We could not find what you were looking for.',
  validation: 'Some of the information is not valid. Please check it and try again.',
  conflict: 'This could not be completed because something has changed. Please review and try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  unavailable: 'The service is temporarily unavailable. Please try again in a moment.',
  unexpected: 'Something went wrong. Please try again.',
};

/** Short headings for an error panel. */
export const ERROR_TITLES: Record<ErrorKind, string> = {
  network: 'You appear to be offline',
  timeout: 'This is taking too long',
  unauthenticated: 'Please sign in',
  forbidden: 'You do not have access',
  not_found: 'We could not find that',
  validation: 'Please check the details',
  conflict: 'Something has changed',
  rate_limited: 'Too many requests',
  unavailable: 'Temporarily unavailable',
  unexpected: 'Something went wrong',
};
