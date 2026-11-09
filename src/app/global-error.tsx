'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';
import { reportBoundaryError } from '@/lib/monitoring/report';

/**
 * The last resort: it replaces the ROOT layout, so it supplies its own <html> and <body> and cannot rely on the app's
 * styles, fonts or components (any of them may be what failed). Plain inline styles only. Shows no message or stack,
 * only Next's opaque digest.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportBoundaryError(error, 'global');
  }, [error]);
  // reset() alone only re-renders the client tree; a failure that came from the server also needs fresh page data.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', background: '#fbf7ef', color: '#1d2a22' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alert" style={{ maxWidth: 448, width: '100%', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: '#0f4f2d' }}>Something went wrong</h1>
            <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.5, color: '#3b3a33' }}>
              We hit an unexpected problem and could not load the page. Please try again. If it keeps happening, come back in a few minutes.
            </p>
            <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={retry}
                style={{ minHeight: 48, padding: '0 24px', borderRadius: 12, border: 0, background: '#0f4f2d', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
              >
                Try again
              </button>
              {/* A plain link on purpose: the router and layouts may be what failed, so this does a full page load. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{ minHeight: 48, padding: '0 24px', borderRadius: 12, border: '1px solid #d9ccaf', background: '#fff', color: '#0f4f2d', fontSize: 16, fontWeight: 600, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                Go to the home page
              </a>
            </div>
            {error.digest && <p style={{ marginTop: 24, fontSize: 14, color: '#5d5645', wordBreak: 'break-all' }}>Reference: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
