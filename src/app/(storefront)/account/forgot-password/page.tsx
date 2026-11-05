import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/storefront/AuthForms';
import { PageShell } from '@/components/storefront/ui';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reset your password' };

export default async function Page() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <PageShell title="Reset your password" narrow>
      <ForgotPasswordForm />
    </PageShell>
  );
}
