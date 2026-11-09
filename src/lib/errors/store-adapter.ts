/**
 * The storefront's door into the shared error model. The customer client (`store-client.ts`) keeps its own
 * `StoreFailure` result and every existing consumer keeps working; pages that want the common model convert with this.
 * Its friendly wording for API codes (INSUFFICIENT_STOCK, ORDER_NOT_PAYABLE, ...) is reused unchanged.
 */
import { friendlyMessage, type StoreFailure } from '../storefront/store-client.ts';
import { fromStoreFailure, type NormalizeOptions } from './normalize.ts';
import type { AppError } from './app-error.ts';

export function appErrorFromStore(failure: StoreFailure, options: NormalizeOptions = {}): AppError {
  return fromStoreFailure(failure, options, (f) => {
    const text = friendlyMessage(f as StoreFailure);
    // Only the client's own code table (or its sign-in sentence) counts as pre-approved wording.
    return text !== f.message ? text : undefined;
  });
}
