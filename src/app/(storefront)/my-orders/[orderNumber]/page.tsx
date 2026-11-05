import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import OrderDetailView from '@/components/storefront/OrderDetailView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { isOrderNumber } from '@/lib/storefront/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order' };

type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();
  const { orderNumber } = await params;
  if (!isOrderNumber(orderNumber)) notFound();
  const raw = (await searchParams).notice;
  const notice = Array.isArray(raw) ? raw[0] : raw;
  return (
    <PageShell title="Your order">
      <OrderDetailView orderNumber={orderNumber} notice={notice} />
    </PageShell>
  );
}
