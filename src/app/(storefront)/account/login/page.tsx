import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LoginForm } from '@/components/storefront/AuthForms';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();
  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  return (
    <PageShell title="Sign in" narrow>
      <LoginForm next={next} />
    </PageShell>
  );
}
