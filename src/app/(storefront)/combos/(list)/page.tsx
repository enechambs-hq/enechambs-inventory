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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0f4f2d] sm:text-4xl">Year-End Combos</h1>
          <p className="mt-2 max-w-lg text-[#5d5645]">Prices are in Nigerian Naira. Availability is shown as it is right now.</p>
        </div>
        {/* A plain GET form: works without JavaScript and keeps the URL shareable. */}
        <form action="/combos" method="get" role="search" className="flex w-full max-w-sm items-center gap-2">
          <label htmlFor="combo-search" className="sr-only">
            Search combos
          </label>
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b7f6b]" aria-hidden="true" />
            <input
              id="combo-search"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={MAX_SEARCH_LENGTH}
              placeholder="Search combos"
              className="w-full rounded-full border border-[#eadfc8] bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-[#1a7a4a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#145c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
          >
            Search
          </button>
        </form>
      </div>

      {!result.ok ? (
        <LoadError kind={result.kind} retryHref={here} />
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
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
