'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { reportBoundaryError } from '@/lib/monitoring/report';

interface Props {
  /** The error Next.js caught. Its message is NEVER shown: it can be technical or come from a backend. */
  error: Error & { digest?: string };
  /** Next.js's own reset: re-renders the segment. */
  reset: () => void;
  /** A safe place to go instead. */
  homeHref: string;
  homeLabel: string;
  /** `page` fills the screen (sign-in pages, root); `inline` sits inside an existing layout. */
  layout?: 'page' | 'inline';
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';

/**
 * The friendly fallback shown by every error boundary. It says what happened in plain words, offers "Try again"
 * (the framework's reset) and a safe way out, and shows only Next's opaque `digest` as a reference an engineer can find
 * in the server logs. No stack, no message, no backend text. This is for UNEXPECTED exceptions only; failed requests keep
 * their own page-level states.
 */
export default function ErrorPanel({ error, reset, homeHref, homeLabel, layout = 'inline' }: Props) {
  const router = useRouter();
  // reset() alone only re-renders the client tree; an error that came from the server needs the page data fetched again too.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  useEffect(() => {
    // Browser console for developers; and, when monitoring is configured, one scrubbed incident report.
    console.error(error);
    reportBoundaryError(error, layout === 'page' ? 'page' : 'segment');
  }, [error, layout]);

  return (
    <div className={layout === 'page' ? 'flex min-h-dvh items-center justify-center bg-[#fbf7ef] px-4 py-10' : 'flex justify-center px-4 py-16'}>
      <div role="alert" className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fdf6dc] text-[#7a5a0c]" aria-hidden="true">
          <TriangleAlert size={28} />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0f4f2d]">Something went wrong</h1>
        <p className="mt-3 text-base text-[#3b3a33]">
          We hit an unexpected problem and could not show this page. Please try again. If it keeps happening, come back in a few minutes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={retry}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] ${focus}`}
          >
            <RotateCcw size={18} aria-hidden="true" />
            Try again
          </button>
          <Link
            href={homeHref}
            className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] ${focus}`}
          >
            {homeLabel}
          </Link>
        </div>
        {error.digest && <p className="mt-6 break-all text-sm text-[#5d5645]">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
