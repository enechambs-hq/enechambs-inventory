'use client';

/** The signed-in customer's address book, loaded through the customer BFF. */
import { useCallback, useEffect, useState } from 'react';
import { parseAddressList, type Address } from '@/lib/storefront/addresses';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import type { AppError } from '@/lib/errors/app-error';

export type AddressesState =
  | { status: 'loading' }
  | { status: 'ready'; addresses: Address[] }
  | { status: 'error'; message: string; error: AppError };

export function useAddresses(enabled: boolean): AddressesState & { reload: () => void } {
  const [state, setState] = useState<AddressesState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    storeRequest({ path: 'storefront/addresses', parse: parseAddressList, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      setState(r.ok ? { status: 'ready', addresses: r.data } : { status: 'error', message: friendlyMessage(r), error: appErrorFromStore(r, { method: 'GET', what: 'your addresses' }) });
    });
    return () => controller.abort();
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
