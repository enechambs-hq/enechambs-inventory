'use client';

import { ShieldAlert } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { canViewStorefrontReports } from '@/lib/nav-config';
import { UserRole } from '@/types';

/**
 * Route-level guard for administrator-only online-store pages. Like AdminOnly it
 * withholds the page content so a staff user never mounts the page or triggers
 * its API calls while the redirect happens. The backend independently answers
 * 403 to non-admins: this component is a courtesy, not the control.
 */
export default function OnlineAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuthGuard(UserRole.ADMIN);
  if (!canViewStorefrontReports(user?.role)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6" role="alert">
        <ShieldAlert size={28} className="text-gray-400 mb-3" />
        <p className="text-sm text-gray-500">Online store reports are available to administrators only.</p>
      </div>
    );
  }
  return <>{children}</>;
}
