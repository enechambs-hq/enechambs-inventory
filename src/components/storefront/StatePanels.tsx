import Link from 'next/link';
import { AlertCircle, PackageOpen, SearchX } from 'lucide-react';
import type { FailureKind } from '@/lib/storefront/catalogue-client';

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-[#eadfc8] bg-white/70 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6efe0] text-[#1a7a4a]">{icon}</div>
      <h2 className="text-lg font-semibold text-[#1d2a22]">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-[#5d5645]">{children}</div>
    </div>
  );
}

const linkClass =
  'mt-5 inline-flex items-center rounded-full bg-[#1a7a4a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#145c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';

export function EmptyCatalogue() {
  return (
    <Panel icon={<PackageOpen size={26} />} title="No combos available right now">
      <p>The Year-End Combos have not been published yet. Please check back soon.</p>
    </Panel>
  );
}

export function NoMatches({ q }: { q: string }) {
  return (
    <Panel icon={<SearchX size={26} />} title="No combos match your search">
      <p>
        Nothing matched &ldquo;<span className="font-medium">{q}</span>&rdquo;. Try a different word, or see everything.
      </p>
      <Link href="/combos" className={linkClass}>
        Show all combos
      </Link>
    </Panel>
  );
}

export function PageOutOfRange({ href }: { href: string }) {
  return (
    <Panel icon={<SearchX size={26} />} title="That page does not exist">
      <p>There are no combos on this page.</p>
      <Link href={href} className={linkClass}>
        Back to the first page
      </Link>
    </Panel>
  );
}

const ERROR_COPY: Record<FailureKind, { title: string; body: string }> = {
  rate_limited: { title: 'Too many requests', body: 'Please wait a moment, then try again.' },
  unavailable: { title: 'The shop is temporarily unavailable', body: 'We could not load the combos just now. Please try again in a moment.' },
  disabled: { title: 'The shop is not open yet', body: 'Please check back soon.' },
  not_found: { title: 'We could not find that', body: 'It may have been removed or is not available.' },
  error: { title: 'Something went wrong', body: 'We could not load the combos. Please try again.' },
};

/** A server-rendered error state; "Try again" is a plain link back to the same URL. */
export function LoadError({ kind, retryHref }: { kind: FailureKind; retryHref: string }) {
  const copy = ERROR_COPY[kind];
  return (
    <div role="alert">
      <Panel icon={<AlertCircle size={26} />} title={copy.title}>
        <p>{copy.body}</p>
        <Link href={retryHref} className={linkClass}>
          Try again
        </Link>
      </Panel>
    </div>
  );
}
