import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CartView from '@/components/storefront/CartView';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your cart' };

export default function CartPage() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <CartView />
    </div>
  );
}
