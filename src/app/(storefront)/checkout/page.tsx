import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CheckoutView from '@/components/storefront/CheckoutView';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <CheckoutView />
    </div>
  );
}
