import AuthProvider from '@/components/providers/AuthProvider';
import InventoryShell from '@/components/layout/InventoryShell';

/**
 * Server boundary for the staff application. The staff AuthProvider lives here
 * (not in the root layout) so the public storefront runs no staff session
 * code; the shell below is a client component that calls useAuthGuard() and is
 * rendered INSIDE the provider.
 */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <InventoryShell>{children}</InventoryShell>
    </AuthProvider>
  );
}
