import { Suspense } from 'react';
import type { Metadata } from 'next';
import OrdersListRoute from '@/components/storefront-orders/OrdersListRoute';

export const metadata: Metadata = { title: 'Online orders' };

/** Staff and administrators. The backend enforces the role on every call. */
export default function StorefrontOrdersPage() {
  // useSearchParams (the alert links preset the filters) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <OrdersListRoute />
    </Suspense>
  );
}
