import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CartView from '@/components/storefront/CartView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your cart' };

export default function CartPage() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <PageShell title="Your cart">
      <CartView />
    </PageShell>
  );
}
