import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthFrame, RegisterForm } from '@/components/storefront/AuthForms';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create an account' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();
  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  return (
    <AuthFrame title="Create an account">
      <RegisterForm next={next} />
    </AuthFrame>
  );
}
