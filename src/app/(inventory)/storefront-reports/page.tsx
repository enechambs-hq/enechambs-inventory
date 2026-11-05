import type { Metadata } from 'next';
import OnlineAdminOnly from '@/components/storefront-orders/OnlineAdminOnly';
import StorefrontReport from '@/components/storefront-orders/StorefrontReport';

export const metadata: Metadata = { title: 'Online store reports' };

/** Administrators only (the backend answers 403 to anyone else). */
export default function StorefrontReportsPage() {
  return (
    <OnlineAdminOnly>
      <StorefrontReport />
    </OnlineAdminOnly>
  );
}
