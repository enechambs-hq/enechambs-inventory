'use client';

import ErrorPanel from '@/components/errors/ErrorPanel';

/** Unexpected errors inside the storefront pages. The header and footer stay, because this renders inside the storefront layout. */
export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} homeHref="/combos" homeLabel="See all combos" />;
}
