import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isStorefrontEnabled } from '@/lib/server/flags';

/**
 * Switched off means 404 with a real status (see combos/layout.tsx for why the
 * check sits in the layout). Private customer pages are not indexed. Each page
 * still checks the flag itself.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isStorefrontEnabled()) notFound();
  return children;
}
