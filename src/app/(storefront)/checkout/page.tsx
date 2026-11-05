import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CheckoutView from '@/components/storefront/CheckoutView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <PageShell title="Checkout">
      <CheckoutView />
    </PageShell>
  );
}
