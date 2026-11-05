import Link from 'next/link';
import { loginHref, registerHref } from '@/lib/storefront/redirects';
import { btnPrimary, btnSecondary, Card } from './ui';

/** Shown to a guest on a page that needs an account. `next` brings them back; their cart is kept. */
export default function SignInPrompt({ next, reason }: { next: string; reason: string }) {
  return (
    <Card>
      <h2 className="text-lg font-bold text-[#0f4f2d]">Sign in to continue</h2>
      <p className="mt-1 text-sm text-[#5d5645]">{reason} Your cart will be waiting for you.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={loginHref(next)} className={btnPrimary}>
          Sign in
        </Link>
        <Link href={registerHref(next)} className={btnSecondary}>
          Create an account
        </Link>
      </div>
    </Card>
  );
}
