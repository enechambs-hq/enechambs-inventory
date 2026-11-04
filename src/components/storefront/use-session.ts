'use client';

/**
 * Who is signed in, as far as the page can tell. It asks the API through the
 * BFF (`auth/me`); the session itself is an HttpOnly cookie this code cannot
 * see, so there is no token to read, store or leak. 401 simply means "signed out".
 */
import { useCallback, useEffect, useState } from 'react';
import { parseProfile, type CustomerProfile } from '@/lib/storefront/orders';
import { storeRequest } from '@/lib/storefront/store-client';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; profile: CustomerProfile }
  | { status: 'unavailable' };

/**
 * `revalidateOn` lets a component that outlives navigation (the header) ask
 * again when something changes, e.g. the pathname after signing in or out.
 */
export function useSession(revalidateOn?: string): SessionState & { refresh: () => void; signOut: () => Promise<void> } {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    storeRequest({ path: 'storefront/auth/me', parse: parseProfile, signal: controller.signal }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok) setState({ status: 'signed_in', profile: r.data });
      else if (r.kind === 'unauthenticated') setState({ status: 'signed_out' });
      else setState({ status: 'unavailable' });
    });
    return () => controller.abort();
  }, [nonce, revalidateOn]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const signOut = useCallback(async () => {
    // The cart is deliberately left alone: it belongs to the browser, not the session.
    await storeRequest({ path: 'auth/logout', method: 'POST', body: {}, parse: () => true });
    setState({ status: 'signed_out' });
  }, []);

  return { ...state, refresh, signOut };
}
