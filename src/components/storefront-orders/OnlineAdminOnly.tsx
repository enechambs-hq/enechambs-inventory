'use client';

import AccessGate from '@/components/auth/AccessGate';
import { UserRole } from '@/types';

/**
 * Route-level guard for administrator-only online-store pages. Like AdminOnly it withholds the page content, so a staff
 * user never mounts the page or triggers its API calls. The backend independently answers 403 to non-admins.
 */
export default function OnlineAdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate role={UserRole.ADMIN} message="Online store reports are available to administrators only.">
      {children}
    </AccessGate>
  );
}
