import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PaymentReturnView from '@/components/storefront/PaymentReturnView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The provider appends its own query (status, tx_ref, transaction_id). Only
 * `order` (set by us when the checkout was created) is read; the rest is ignored.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();
  const raw = (await searchParams).order;
  const order = Array.isArray(raw) ? raw[0] : raw;
  return (
    <PageShell title="Your payment">
      <PaymentReturnView orderNumber={typeof order === 'string' ? order : null} />
    </PageShell>
  );
}
