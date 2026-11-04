import type { Metadata } from 'next';
import OrdersList from '@/components/storefront-orders/OrdersList';

export const metadata: Metadata = { title: 'Online orders' };

/** Staff and administrators. The backend enforces the role on every call. */
export default function StorefrontOrdersPage() {
  return <OrdersList />;
}
