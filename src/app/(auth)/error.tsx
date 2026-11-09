'use client';

import ErrorPanel from '@/components/errors/ErrorPanel';

/** Unexpected errors on the staff sign-in and password-setup pages. */
export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} homeHref="/login" homeLabel="Back to sign in" layout="page" />;
}
