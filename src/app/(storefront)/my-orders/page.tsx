import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MyOrdersView from '@/components/storefront/MyOrdersView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My orders' };

export default function MyOrdersPage() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <PageShell title="My orders">
      <MyOrdersView />
    </PageShell>
  );
}
