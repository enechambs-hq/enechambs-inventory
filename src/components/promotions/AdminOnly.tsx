'use client';

import AccessGate from '@/components/auth/AccessGate';
import { UserRole } from '@/types';

/**
 * Route-level protection for promotion pages. Content (and its API calls) is withheld until the person is known to be
 * signed in as an administrator; anyone else sees the forbidden state and stays signed in. The backend independently
 * answers 403 to non-admins.
 */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate role={UserRole.ADMIN} message="Promotions are available to administrators only.">
      {children}
    </AccessGate>
  );
}
