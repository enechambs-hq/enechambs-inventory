'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronLeft, ChevronRight, ImageIcon, Megaphone, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import AdminOnly from '@/components/promotions/AdminOnly';
import ComboStatusBadge from '@/components/promotions/ComboStatusBadge';
import SkeletonRow from '@/components/shared/SkeletonRow';
import { combosService } from '@/lib/services/combos.service';
import { COMBO_STATUS_OPTIONS, LIST_PAGE_SIZE, MAX_SEARCH_LENGTH } from '@/lib/combos/constants';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { formatNaira } from '@/lib/combos/format';
import type { Combo, ComboListMeta, ComboStatus } from '@/types/combos';

const SEARCH_DEBOUNCE_MS = 350;

function Thumbnail({ combo }: { combo: Combo }) {
  const first = combo.images[0];
  return (
    <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
      {first?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-provided public media URL
        <img src={first.url} alt={first.altText} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon size={16} className="text-gray-300" aria-label="No image" />
      )}
    </div>
  );
}

function CombosList() {
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

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotional combos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage year-end combos. Each combo has its own stock, separate from inventory.
          </p>
        </div>
        <Link
          href="/promotions/combos/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors shadow-sm shrink-0"
        >
          <Plus size={16} />
          New combo
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[14rem] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <label htmlFor="combo-search" className="sr-only">
              Search combos by name or slug
            </label>
            <input
              id="combo-search"
              type="search"
              value={searchInput}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or slug…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="combo-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="combo-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ComboStatus | '');
                setPage(1);
              }}
              className="px-3.5 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
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
          <div role="alert" className="flex flex-col items-center text-center py-16 px-6">
            <AlertCircle size={28} className="text-red-400 mb-3" />
            <p className="text-sm font-medium text-gray-800">Could not load combos</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto" aria-busy={isLoading}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Combo', 'Price', 'Stock', 'Status', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      scope="col"
                      className={`px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                        i === 4 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} widths={[240, 120, 150, 90, 60]} />)
                ) : combos.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      {filtered ? (
                        <div className="py-16 text-center">
                          <p className="text-sm text-gray-500">No combos match your search or filter.</p>
                          <button type="button" onClick={clearFilters} className="text-sm text-[#1a7a4a] mt-1 hover:underline">
                            Clear search and filter
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                          <div className="w-20 h-20 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-6">
                            <Megaphone size={32} className="text-[#1a7a4a]" />
                          </div>
                          <h2 className="text-xl font-bold text-gray-900 mb-2">No combos yet</h2>
                          <p className="text-sm text-gray-500 mb-8 max-w-sm">
                            A combo is a bundle sold at a promotional price from its own stock. Create your first one,
                            add images, then publish it.
                          </p>
                          <Link
                            href="/promotions/combos/new"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors"
                          >
                            <Plus size={16} />
                            Create your first combo
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  combos.map((combo) => (
                    <tr key={combo.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Thumbnail combo={combo} />
                          <div className="min-w-0">
                            <Link
                              href={`/promotions/combos/${combo.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-[#1a7a4a] hover:underline"
                            >
                              {combo.name}
                            </Link>
                            <p className="text-xs text-gray-400 truncate">/{combo.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-medium text-gray-900">{formatNaira(combo.price)}</span>
                        {combo.referencePrice !== null && (
                          <span className="block text-xs text-gray-400 line-through">{formatNaira(combo.referencePrice)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="font-medium">{combo.remainingQuantity.toLocaleString('en-NG')}</span> left of{' '}
                        {combo.totalQuantity.toLocaleString('en-NG')}
                        <span className="block text-xs text-gray-400">
                          {combo.allocatedQuantity.toLocaleString('en-NG')} allocated
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ComboStatusBadge status={combo.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/promotions/combos/${combo.id}`}
                          aria-label={`Edit ${combo.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1a7a4a] rounded-lg hover:bg-[#e8f5ee]"
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && !error && (
          <nav aria-label="Pagination" className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total.toLocaleString('en-NG')} combos
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </nav>
        )}
      </div>
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
