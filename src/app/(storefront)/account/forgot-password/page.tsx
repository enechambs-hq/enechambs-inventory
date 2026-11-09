import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthFrame, ForgotPasswordForm } from '@/components/storefront/AuthForms';
import { isStorefrontEnabled } from '@/lib/server/flags';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reset your password' };

export default async function Page() {
  if (!isStorefrontEnabled()) notFound();
  return (
    <AuthFrame title="Reset your password">
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
