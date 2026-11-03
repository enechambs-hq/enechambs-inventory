'use client';

import { ShieldAlert } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { canManagePromotions } from '@/lib/nav-config';
import { UserRole } from '@/types';

/**
 * Route-level protection for promotion pages, using the existing admin guard
 * (useAuthGuard redirects non-admins to /inventory). Unlike some older pages it
 * also withholds the page content, so a staff user never mounts the page or
 * triggers its API calls while the redirect happens. The backend independently
 * answers 403 to non-admins.
 */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuthGuard(UserRole.ADMIN);
  if (!canManagePromotions(user?.role)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6" role="alert">
        <ShieldAlert size={28} className="text-gray-400 mb-3" />
        <p className="text-sm text-gray-500">Promotions are available to administrators only.</p>
      </div>
    );
  }
  return <>{children}</>;
}
