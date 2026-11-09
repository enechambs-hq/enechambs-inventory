'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { resolveAccess, type AccessStatus } from '@/lib/auth/access';
import { signInUrl } from '@/lib/auth/return-path';
import { signOutIntent } from '@/lib/auth/sign-out-intent';
import type { UserRole } from '@/types';

const noSubscription = () => () => {};

/**
 * The staff access guard. `status` says whether the page may be shown (see lib/auth/access.ts); callers render nothing
 * until it is 'allowed', so a page's own data requests do not start before access is known. An unauthenticated visitor is
 * sent to sign-in with the page they wanted remembered. A signed-in person without the required role is NOT redirected or
 * signed out: the caller shows a forbidden state.
 */
export const useAuthGuard = (requiredRole?: UserRole): { user: ReturnType<typeof useAuthStore.getState>['user']; isAuthenticated: boolean; status: AccessStatus } => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  // False on the server and during hydration, true afterwards: no flash of sign-in or content, and no state-in-effect.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const status = resolveAccess({ hydrated, isAuthenticated, role: user?.role, requiredRole });

  useEffect(() => {
    // After a deliberate sign-out the page is not remembered; after anything else it is.
    if (status === 'unauthenticated') router.replace(signOutIntent.isActive() ? '/login' : signInUrl({ returnTo: `${pathname}${window.location.search}` }));
  }, [status, router, pathname]);

  return { user, isAuthenticated, status };
};
