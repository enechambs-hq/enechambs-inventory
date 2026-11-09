'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import { appErrorFromStaff } from '@/lib/errors/staff-adapter';
import type { AppError } from '@/lib/errors/app-error';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';
import { formatLagosDateTime, formatNaira } from '@/lib/storefront-orders/format';
import { ORDERS_PAGE_SIZE } from '@/lib/storefront-orders/orders-api';
import type { AdminCustomerRow, ListMeta } from '@/types/storefront-orders';

const SEARCH_DEBOUNCE_MS = 350;
const MAX_SEARCH_LENGTH = 100;
const HEADERS = ['Customer', 'Phone', 'Joined', 'Orders', 'Total paid', 'Last order'];

const outlineBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const pagerBtn =
  'inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="break-words text-base text-gray-900">{children}</dd>
    </div>
  );
}

function CustomerCard({ c }: { c: AdminCustomerRow }) {
  return (
    <li className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
      <p className="break-words text-base font-semibold text-[#0f4f2d]">{c.customerName}</p>
      <p className="break-all text-sm text-gray-600">{c.customerEmail}</p>
      <p className="break-words text-sm text-gray-600">{c.customerPhone}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-gray-100 pt-3">
        <Fact label="Joined"><span className="text-sm">{formatLagosDateTime(c.joinedAt)}</span></Fact>
        <Fact label="Orders">
          <span className="font-semibold">{c.orderCount}</span>
          <span className="block text-sm text-gray-600">{c.paidOrderCount} paid</span>
        </Fact>
        <Fact label="Total paid"><span className="font-semibold">{formatNaira(c.totalPaid)}</span></Fact>
        <Fact label="Last order"><span className="text-sm">{c.lastOrderAt ? formatLagosDateTime(c.lastOrderAt) : 'No orders yet'}</span></Fact>
      </dl>
    </li>
  );
}

function CardSkeleton() {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4" aria-hidden="true">
      <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    </li>
  );
}

export default function OnlineCustomers() {
  const cards = useMediaQuery('(max-width: 1279px)');
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
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
      setError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'online customers' }));
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

  const emptyState = (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f5ee]">
        <Users size={26} className="text-[#1a7a4a]" />
      </div>
      <p className="text-base font-semibold text-gray-900">{search ? 'No customers match this search.' : 'No online customers yet.'}</p>
      {search && (
        <button type="button" onClick={reset} className={`${outlineBtn} mt-3`}>
          Clear search
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">Online customers</h1>
        <p className="mt-1 text-sm text-gray-600">
          People who signed up on the online store. In-store customers are not listed here. Total paid is verified money that has not been refunded.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 min-[480px]:flex-row min-[480px]:items-end">
        <div className="min-w-0 flex-1 min-[480px]:max-w-md">
          <label htmlFor="customer-search" className="mb-1 block text-sm font-medium text-gray-700">Search</label>
          <input
            id="customer-search"
            type="search"
            aria-label="Search customers"
            value={searchInput}
            maxLength={MAX_SEARCH_LENGTH}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email or phone"
            className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20"
          />
        </div>
        {search !== '' && (
          <button type="button" onClick={reset} className={outlineBtn}>Clear search</button>
        )}
      </div>

      {error ? (
        <LoadErrorPanel error={error} onRetry={() => void load()} title="Could not load online customers" />
      ) : cards ? (
        <div aria-busy={isLoading}>
          {isLoading ? (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
            </ul>
          ) : customers.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white">{emptyState}</div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {customers.map((c) => <CustomerCard key={c.id} c={c} />)}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white" aria-busy={isLoading}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} scope="col" className="sticky top-14 z-[1] border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-semibold text-gray-700 first:rounded-tl-2xl first:pl-5 last:rounded-tr-2xl last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100" aria-hidden="true">
                    {[170, 110, 120, 60, 90, 120].map((w, j) => (
                      <td key={j} className="px-3 py-5 first:pl-5 last:pr-5">
                        <div className="h-4 max-w-full animate-pulse rounded bg-gray-200" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length}>{emptyState}</td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="min-h-16 border-b border-gray-100 align-top last:border-0 hover:bg-gray-50">
                    <td className="min-w-[12rem] px-3 py-3 pl-5">
                      <span className="block break-words text-base font-semibold text-[#0f4f2d]">{c.customerName}</span>
                      <span className="block break-all text-sm text-gray-600">{c.customerEmail}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{c.customerPhone}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{formatLagosDateTime(c.joinedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">
                      <span className="text-base font-semibold text-gray-900">{c.orderCount}</span>
                      <span className="block text-sm text-gray-600">{c.paidOrderCount} paid</span>
                    </td>
                    <td className="px-3 py-3 text-base font-semibold text-gray-900">{formatNaira(c.totalPaid)}</td>
                    <td className="px-3 py-3 pr-5 text-sm text-gray-600">{c.lastOrderAt ? formatLagosDateTime(c.lastOrderAt) : 'No orders yet'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && !error && (
        <nav aria-label="Customer pages" className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:flex sm:justify-between">
          <span className="order-1 sm:order-none">{meta.total.toLocaleString('en-NG')} customers</span>
          <div className="contents sm:flex sm:items-center sm:gap-3">
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)} className={`order-3 sm:order-none ${pagerBtn}`}>
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="order-2 text-right sm:order-none">Page {meta.page} of {meta.totalPages}</span>
            <button type="button" disabled={page >= meta.totalPages || isLoading} onClick={() => setPage((p) => p + 1)} className={`order-4 sm:order-none ${pagerBtn}`}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
