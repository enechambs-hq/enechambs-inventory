import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AddressBookView from '@/components/storefront/AddressBookView';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Address book' };

export default function Page() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <PageShell title="Address book">
      <AddressBookView />
    </PageShell>
  );
}
