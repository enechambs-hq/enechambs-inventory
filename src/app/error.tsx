'use client';

import ErrorPanel from '@/components/errors/ErrorPanel';

/**
 * The fallback for anything the section boundaries do not catch: notably a failure in a section's own layout (the admin
 * shell, the storefront header), because a boundary cannot catch errors from the layout that renders it.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} homeHref="/" homeLabel="Go to the home page" layout="page" />;
}
