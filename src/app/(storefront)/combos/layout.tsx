import { notFound } from 'next/navigation';
import { isStorefrontEnabled } from '@/lib/server/flags';

/**
 * Switched off means 404 for every /combos URL, with a real 404 status. The
 * check sits here, above the list page's streaming loading boundary: once a
 * response has started streaming its status can no longer change, so a
 * notFound() raised inside the boundary would reach the browser as a 200.
 * Each page still checks the flag itself; this is not the only guard.
 */
export default function CombosLayout({ children }: { children: React.ReactNode }) {
  if (!isStorefrontEnabled()) notFound();
  return children;
}
