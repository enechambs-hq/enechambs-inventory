import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthFrame, LoginForm } from '@/components/storefront/AuthForms';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();
  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  return (
    <AuthFrame title="Sign in">
      <LoginForm next={next} />
    </AuthFrame>
  );
}
