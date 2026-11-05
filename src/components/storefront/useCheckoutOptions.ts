'use client';

/** The delivery fee and the pickup details shown at checkout (public; the same for everyone). */
import { useEffect, useState } from 'react';
import { parseCheckoutOptions, type CheckoutOptions } from '@/lib/storefront/addresses';
import { storeRequest } from '@/lib/storefront/store-client';

export function useCheckoutOptions(): CheckoutOptions | null {
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    storeRequest({ path: 'storefront/checkout-options', parse: parseCheckoutOptions, signal: controller.signal }).then((r) => {
      if (!controller.signal.aborted && r.ok) setOptions(r.data);
    });
    return () => controller.abort();
  }, []);
  return options;
}
