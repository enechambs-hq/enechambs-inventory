import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogueHref } from '@/lib/storefront/catalogue';
import type { PublicListMeta } from '@/types/storefront';

const base =
  'inline-flex items-center gap-1 rounded-full border border-[#eadfc8] bg-white px-4 py-2 text-sm font-medium text-[#1d2a22] transition hover:border-[#1a7a4a] hover:text-[#1a7a4a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const disabled = 'inline-flex items-center gap-1 rounded-full border border-[#eadfc8] bg-white/50 px-4 py-2 text-sm font-medium text-[#b3aa95]';

/** Previous / Next as real links, so paging works without JavaScript and is shareable. */
export default function Pagination({ meta, q }: { meta: PublicListMeta; q: string }) {
  if (meta.totalPages <= 1) return null;
  const hasPrev = meta.page > 1;
  const hasNext = meta.page < meta.totalPages;
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      {hasPrev ? (
        <Link href={catalogueHref({ q, page: meta.page - 1 })} rel="prev" className={base}>
          <ChevronLeft size={16} aria-hidden="true" /> Previous
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          <ChevronLeft size={16} aria-hidden="true" /> Previous
        </span>
      )}
      <p className="text-sm text-[#5d5645]">
        Page {meta.page} of {meta.totalPages}
      </p>
      {hasNext ? (
        <Link href={catalogueHref({ q, page: meta.page + 1 })} rel="next" className={base}>
          Next <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          Next <ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
