import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Search } from 'lucide-react';
import ComboCard from '@/components/storefront/ComboCard';
import Pagination from '@/components/storefront/Pagination';
import { EmptyCatalogue, LoadError, NoMatches, PageOutOfRange } from '@/components/storefront/StatePanels';
import { isStorefrontEnabled } from '@/lib/server/flags';
import {
  CATALOGUE_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  catalogueHref,
  parsePageParam,
  parseSearchParam,
} from '@/lib/storefront/catalogue';
import { getComboList } from '@/lib/storefront/catalogue.server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Year-End Combos' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CombosPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isStorefrontEnabled()) notFound();

  const params = await searchParams;
  const page = parsePageParam(params.page);
  const q = parseSearchParam(params.q);
  const here = catalogueHref({ q, page });

  const result = await getComboList({ page, limit: CATALOGUE_PAGE_SIZE, q });

  return (
    <div className="mx-auto max-w-[80rem] px-4 py-10 sm:px-6 md:py-12 lg:px-8">
      <div className="mb-10 flex flex-col gap-5 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Year-End Combos</h1>
          <p className="mt-2 text-base text-[#5d5645]">Pick your combos and add them to your cart.</p>
        </div>
        {/* A plain GET form: works without JavaScript and keeps the URL shareable. */}
        <form action="/combos" method="get" role="search" className="flex w-full items-center gap-2 lg:max-w-sm">
          <label htmlFor="combo-search" className="sr-only">
            Search combos
          </label>
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 hidden -translate-y-1/2 text-[#8b7f6b] sm:block" aria-hidden="true" />
            <input
              id="combo-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={MAX_SEARCH_LENGTH}
              placeholder="Search combos"
              className="w-full rounded-full border border-[#eadfc8] bg-white py-2.5 pl-4 pr-12 text-base outline-none transition focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20 sm:pl-10 sm:pr-4 sm:text-sm"
            />
            {/* Phones: the magnifier is the submit control, inside the field. */}
            <button
              type="submit"
              aria-label="Search combos"
              className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] sm:hidden"
            >
              <Search size={20} aria-hidden="true" />
            </button>
          </div>
          <button
            type="submit"
            className="hidden rounded-full bg-[#1a7a4a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#145c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] sm:inline-flex"
          >
            Search
          </button>
        </form>
      </div>

      {!result.ok ? (
        <LoadError kind={result.kind} status={result.status} retryHref={here} />
      ) : result.data.data.length === 0 ? (
        result.data.meta.total > 0 ? (
          <PageOutOfRange href={catalogueHref({ q })} />
        ) : q ? (
          <NoMatches q={q} />
        ) : (
          <EmptyCatalogue />
        )
      ) : (
        <>
          {q && (
            <p className="mb-5 text-sm text-[#5d5645]">
              {result.data.meta.total} {result.data.meta.total === 1 ? 'combo' : 'combos'} matching &ldquo;{q}&rdquo;
            </p>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
            {result.data.data.map((combo, i) => (
              <ComboCard key={combo.slug} combo={combo} priority={i < 4} />
            ))}
          </ul>
          <Pagination meta={result.data.meta} q={q} />
        </>
      )}
    </div>
  );
}
