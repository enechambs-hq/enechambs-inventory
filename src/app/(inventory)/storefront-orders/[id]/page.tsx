import type { Metadata } from 'next';
import OrderDetail from '@/components/storefront-orders/OrderDetail';

export const metadata: Metadata = { title: 'Online order' };

type Params = Promise<{ id: string }>;

/** `[id]` is the order number (the backend's public identifier for an order). */
export default async function StorefrontOrderPage({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderDetail orderNumber={decodeURIComponent(id)} />;
}
