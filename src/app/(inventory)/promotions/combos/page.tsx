'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, ImageIcon, Megaphone, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboStatusBadge from '@/components/promotions/ComboStatusBadge';
import { combosService } from '@/lib/services/combos.service';
import { COMBO_STATUS_OPTIONS, LIST_PAGE_SIZE, MAX_SEARCH_LENGTH } from '@/lib/combos/constants';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { formatNaira } from '@/lib/combos/format';
import type { Combo, ComboListMeta, ComboStatus } from '@/types/combos';

const SEARCH_DEBOUNCE_MS = 350;

const fmt = (n: number) => n.toLocaleString('en-NG');
const control =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20';
const outlineBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';

function Thumbnail({ combo, size = 56 }: { combo: Combo; size?: number }) {
  const first = combo.images[0];
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
      style={{ width: size, height: size }}
    >
      {first?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-provided public media URL
        <img src={first.url} alt={first.altText} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon size={20} className="text-gray-400" aria-label="No image" />
      )}
    </div>
  );
}

function Price({ combo }: { combo: Combo }) {
  return (
    <>
      <span className="text-base font-semibold text-gray-900">{formatNaira(combo.price)}</span>
      {combo.referencePrice !== null && (
        <span className="ml-2 text-sm text-gray-500 line-through lg:ml-0 lg:block">{formatNaira(combo.referencePrice)}</span>
      )}
    </>
  );
}

function Stock({ combo }: { combo: Combo }) {
  return (
    <>
      <span className="font-semibold">{fmt(combo.remainingQuantity)}</span> left of {fmt(combo.totalQuantity)}
      <span className="block text-sm text-gray-600">{fmt(combo.allocatedQuantity)} allocated</span>
    </>
  );
}

function CardSkeleton() {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4" aria-hidden="true">
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-11 animate-pulse rounded-lg bg-gray-200" />
    </li>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100" aria-hidden="true">
          <td className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            </div>
          </td>
          {[80, 100, 90, 70].map((w, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-gray-200" style={{ width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function CombosList() {
  const cards = useMediaQuery('(max-width: 1023px)');
  const [combos, setCombos] = useState<Combo[]>([]);
  const [meta, setMeta] = useState<ComboListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ComboStatus | ''>('');
  const [page, setPage] = useState(1);

  // Debounce typing; a new search always starts at page 1.
  const appliedQ = useRef('');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === appliedQ.current) return;
      appliedQ.current = next;
      setQ(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Ignore responses from superseded requests.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await combosService.list({ page, limit: LIST_PAGE_SIZE, status, q });
      if (id !== requestId.current) return;
      setCombos(result.data);
      setMeta(result.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(explainProblem(describeApiError(err), 'load'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = q !== '' || status !== '';
  const clearFilters = () => {
    setSearchInput('');
    appliedQ.current = '';
    setQ('');
    setStatus('');
    setPage(1);
  };

  const emptyState = filtered ? (
    <div className="py-14 text-center">
      <p className="text-base text-gray-600">No combos match your search or filter.</p>
      <button type="button" onClick={clearFilters} className={`${outlineBtn} mt-3`}>
        Clear search and filter
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f5ee]">
        <Megaphone size={28} className="text-[#1a7a4a]" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-gray-900">No combos yet</h2>
      <p className="mb-6 max-w-sm text-base text-gray-600">
        A combo is a bundle sold at a promotional price from its own stock. Create your first one, add images, then
        publish it.
      </p>
      <Link
        href="/promotions/combos/new"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1a7a4a] px-5 text-sm font-semibold text-white hover:bg-[#145c37]"
      >
        <Plus size={16} />
        Create your first combo
      </Link>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">Promotional combos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage year-end combos. Each combo has its own stock, separate from inventory.
          </p>
        </div>
        <Link
          href="/promotions/combos/new"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1a7a4a] px-5 text-sm font-semibold text-white hover:bg-[#145c37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
        >
          <Plus size={18} aria-hidden="true" />
          New combo
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 min-[480px]:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label htmlFor="combo-search" className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <input
            id="combo-search"
            type="search"
            value={searchInput}
            maxLength={MAX_SEARCH_LENGTH}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name or slug"
            className={control}
          />
        </div>
        <div>
          <label htmlFor="combo-status-filter" className="mb-1 block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="combo-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ComboStatus | '');
              setPage(1);
            }}
            className={control}
          >
            {COMBO_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
          <AlertCircle size={28} className="mb-3 text-red-500" />
          <p className="text-base font-semibold text-gray-900">Could not load combos</p>
          <p className="mt-1 max-w-md text-base text-gray-600">{error}</p>
          <button type="button" onClick={() => void load()} className={`${outlineBtn} mt-4`}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : cards ? (
        <div aria-busy={isLoading}>
          {isLoading ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </ul>
          ) : combos.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white">{emptyState}</div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {combos.map((combo) => (
                <li key={combo.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <Link
                    href={`/promotions/combos/${combo.id}`}
                    className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
                  >
                    <div className="flex items-start gap-3">
                      <Thumbnail combo={combo} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-base font-semibold text-gray-900">{combo.name}</p>
                        <p className="break-all text-sm text-gray-600">/{combo.slug}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p>
                        <Price combo={combo} />
                      </p>
                      <ComboStatusBadge status={combo.status} />
                    </div>
                    <p className="mt-2 text-base text-gray-700">
                      <Stock combo={combo} />
                    </p>
                  </Link>
                  <Link
                    href={`/promotions/combos/${combo.id}`}
                    aria-label={`Edit ${combo.name}`}
                    className={`${outlineBtn} mt-3 w-full`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="overflow-x-auto" aria-busy={isLoading}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Combo', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      scope="col"
                      className={`px-4 py-3 text-sm font-semibold text-gray-700 ${i === 4 ? 'text-right' : 'text-left'}`}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton />
                ) : combos.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{emptyState}</td>
                  </tr>
                ) : (
                  combos.map((combo) => (
                    <tr key={combo.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumbnail combo={combo} />
                          <div className="min-w-0">
                            <Link
                              href={`/promotions/combos/${combo.id}`}
                              className="inline-block py-1 text-base font-semibold text-gray-900 hover:text-[#1a7a4a] hover:underline"
                            >
                              {combo.name}
                            </Link>
                            <p className="break-all text-sm text-gray-600">/{combo.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Price combo={combo} />
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-700">
                        <Stock combo={combo} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ComboStatusBadge status={combo.status} />
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <Link
                          href={`/promotions/combos/${combo.id}`}
                          aria-label={`Edit ${combo.name}`}
                          className={outlineBtn}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && !error && (
        <nav
          aria-label="Combo pages"
          className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:flex sm:justify-between"
        >
          <span className="order-1 sm:order-none">{fmt(meta.total)} combos</span>
          <div className="contents sm:flex sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1 || isLoading}
              className="order-3 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:order-none"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="order-2 text-right sm:order-none">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page >= meta.totalPages || isLoading}
              className="order-4 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:order-none"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default function CombosPage() {
  return (
    <AdminOnly>
      <CombosList />
    </AdminOnly>
  );
}
