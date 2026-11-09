/**
 * The staff application's door into the shared error model. The staff axios client (`lib/api.ts`) and its interceptors
 * are unchanged: an axios rejection (including the proxy's structured 502/504 from Phase 1) is converted here.
 * The request method is read from the axios config, so a failed write is never marked retryable.
 */
import { fromAxiosError, type NormalizeOptions } from './normalize.ts';
import type { AppError } from './app-error.ts';

export function appErrorFromStaff(error: unknown, options: NormalizeOptions = {}): AppError {
  return fromAxiosError(error, options);
}
