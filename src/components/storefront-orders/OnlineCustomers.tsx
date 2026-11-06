'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Search, Users } from 'lucide-react';
import SkeletonRow from '@/components/shared/SkeletonRow';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';
import { formatLagosDateTime, formatNaira } from '@/lib/storefront-orders/format';
import { ORDERS_PAGE_SIZE } from '@/lib/storefront-orders/orders-api';
import type { AdminCustomerRow, ListMeta } from '@/types/storefront-orders';

const SEARCH_DEBOUNCE_MS = 350;
const MAX_SEARCH_LENGTH = 100;
const HEADERS = ['Customer', 'Phone', 'Joined', 'Orders', 'Total paid', 'Last order'];

const field = 'px-3.5 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20';

export default function OnlineCustomers() {
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const appliedSearch = useRef('');
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next === appliedSearch.current) return;
      appliedSearch.current = next;
      setSearch(next);
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
      const result = await storefrontOrdersService.customers({ page, limit: ORDERS_PAGE_SIZE, search });
      if (id !== requestId.current) return;
      setCustomers(result.data);
      setMeta(result.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(explainProblem(describeApiError(err), 'load'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setSearchInput('');
    appliedSearch.current = '';
    setSearch('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Online customers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          People who signed up on the online store. In-store customers are not listed here. Total paid is verified money that has not been refunded.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[14rem] max-w-sm">
            <Search size={15} className="absolute left-3 bottom-3 text-gray-400" aria-hidden="true" />
            <label htmlFor="customer-search" className="sr-only">Search customers</label>
            <input
              id="customer-search"
              type="search"
              value={searchInput}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email or phone"
              className={`${field} w-full pl-9`}
            />
          </div>
          {search !== '' && (
            <button type="button" onClick={reset} className="pb-2 text-sm text-[#1a7a4a] hover:underline">Clear search</button>
          )}
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-center text-center py-16 px-6">
            <AlertCircle size={28} className="text-red-400 mb-3" />
            <p className="text-sm font-medium text-gray-800">Could not load online customers</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]">
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto" aria-busy={isLoading}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} widths={[160, 110, 120, 70, 90, 120]} />)
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={HEADERS.length}>
                      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-4">
                          <Users size={26} className="text-[#1a7a4a]" />
                        </div>
                        <p className="text-sm font-medium text-gray-800">{search ? 'No customers match this search.' : 'No online customers yet.'}</p>
                        {search && <button type="button" onClick={reset} className="text-sm text-[#1a7a4a] mt-1 hover:underline">Clear search</button>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors align-top">
                      <td className="px-3 py-4 pl-5 text-sm max-w-[15rem]">
                        <span className="block truncate font-medium text-gray-900" title={c.customerName}>{c.customerName}</span>
                        <span className="block truncate text-xs text-gray-400" title={c.customerEmail}>{c.customerEmail}</span>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">{c.customerPhone}</td>
                      <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">{formatLagosDateTime(c.joinedAt)}</td>
                      <td className="px-3 py-4 text-sm whitespace-nowrap">
                        <span className="font-medium text-gray-900">{c.orderCount}</span>
                        <span className="block text-xs text-gray-400">{c.paidOrderCount} paid</span>
                      </td>
                      <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatNaira(c.totalPaid)}</td>
                      <td className="px-3 py-4 pr-5 text-sm text-gray-600 whitespace-nowrap">{c.lastOrderAt ? formatLagosDateTime(c.lastOrderAt) : 'No orders yet'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && !error && (
          <nav aria-label="Customer pages" className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-sm text-gray-600">
            <span>{meta.total.toLocaleString('en-NG')} customers</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft size={14} /> Previous
              </button>
              <span>Page {meta.page} of {meta.totalPages}</span>
              <button type="button" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
