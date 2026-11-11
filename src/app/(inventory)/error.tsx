'use client';

import ErrorPanel from '@/components/errors/ErrorPanel';
import { homeForRole } from '@/lib/nav-config';
import { useAuthStore } from '@/store/auth.store';

/** Unexpected errors inside an admin/staff page. The sidebar and top bar stay, because this renders inside the shell. */
export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const user = useAuthStore((s) => s.user);
  return <ErrorPanel error={error} reset={reset} homeHref={user ? homeForRole(user.role) : '/login'} homeLabel={user ? 'Back to your home page' : 'Back to sign in'} />;
}
