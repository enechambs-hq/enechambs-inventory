import type { Metadata } from 'next';
import OnlineAdminOnly from '@/components/storefront-orders/OnlineAdminOnly';
import OnlineCustomers from '@/components/storefront-orders/OnlineCustomers';

export const metadata: Metadata = { title: 'Online customers' };

/** Administrators only (the backend answers 403 to anyone else). */
export default function StorefrontCustomersPage() {
  return (
    <OnlineAdminOnly>
      <OnlineCustomers />
    </OnlineAdminOnly>
  );
}
