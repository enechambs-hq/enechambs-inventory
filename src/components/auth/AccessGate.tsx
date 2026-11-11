'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { homeForRole } from '@/lib/nav-config';
import { UserRole } from '@/types';

/**
 * Withholds a staff page until access is known. Children (and therefore their data requests) mount only when the person
 * is signed in with the required role; while that is being worked out, or while an unauthenticated visitor is being sent
 * to sign-in, nothing is shown. A signed-in person without the role sees a plain forbidden state and stays signed in.
 * The API remains the real control: this only avoids showing a page that would fail.
 */
export default function AccessGate({
  role = UserRole.ADMIN,
  message = 'This page is available to administrators only.',
  children,
}: {
  role?: UserRole;
  message?: string;
  children: React.ReactNode;
}) {
  const { status, user } = useAuthGuard(role);
  if (status === 'allowed') return <>{children}</>;
  if (status !== 'forbidden') return null;
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-6" role="alert">
      <ShieldAlert size={28} className="text-gray-400 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
      <Link href={homeForRole(user?.role)} className="mt-4 text-sm font-medium text-primary underline underline-offset-2">
        Go to your home page
      </Link>
    </div>
  );
}
