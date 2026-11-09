'use client';

import { useEffect, useState, useCallback } from 'react';
import { ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';
import { formatActivityDescription } from '@/lib/utils';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
import { ActionTag, formatEventTime } from '@/components/activity/ActivityParts';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import { appErrorFromStaff } from '@/lib/errors/staff-adapter';
import type { AppError } from '@/lib/errors/app-error';

export default function ActivityPage() {
  const cards = useMediaQuery('(max-width: 1279px)');

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  // A failed request is shown as a failure, never as an empty history.
  const [error, setError] = useState<AppError | null>(null);

  const limit = 25;

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await dashboardService.getAllActivity(page, limit);
      setLogs(data.data);
      setTotal(data.meta.total);
      setTotalPages(data.meta.totalPages);
    } catch (err) {
      setLogs([]);
      setError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'the activity log' }));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const pagerBtn = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
  const actor = (log: ActivityLog) => (log.user ? `${log.user.firstName} ${log.user.lastName}` : '—');

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold leading-8 text-[#0f4f2d] md:text-[2rem] md:leading-10">Activity Log</h1>
        {!error && <p className="mt-1 text-sm text-gray-600">{total} total events</p>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading activity" className="flex justify-center rounded-2xl border border-gray-200 bg-white py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a7a4a] border-t-transparent" />
        </div>
      ) : error ? (
        <LoadErrorPanel error={error} onRetry={() => void fetchLogs()} title="Could not load the activity log" />
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-base text-gray-600">No activity found</div>
      ) : cards ? (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <ActionTag action={log.action} />
                <p className="text-sm text-gray-600">{formatEventTime(log.timestamp)}</p>
              </div>
              <p className="mt-2 text-base font-semibold text-[#0f4f2d]">
                {actor(log)}
                {log.user && <span className="ml-2 text-sm font-normal capitalize text-gray-600">({log.user.role})</span>}
              </p>
              <p className="mt-1 break-words text-base text-gray-800">{formatActivityDescription(log.description)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['User', 'Role', 'Action', 'Description', 'Time'].map((h) => (
                  <th key={h} scope="col" className="sticky top-14 z-[1] border-b border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm font-semibold text-gray-700 first:rounded-tl-2xl first:pl-5 last:rounded-tr-2xl last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 align-top last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 pl-5 text-base font-semibold text-[#0f4f2d] [overflow-wrap:anywhere]">{actor(log)}</td>
                  <td className="px-3 py-3 text-sm capitalize text-gray-700">{log.user ? log.user.role : '—'}</td>
                  <td className="px-3 py-3"><ActionTag action={log.action} /></td>
                  <td className="px-3 py-3 text-sm text-gray-800 [overflow-wrap:anywhere]">{formatActivityDescription(log.description)}</td>
                  <td className="whitespace-nowrap px-3 py-3 pr-5 text-sm text-gray-700">{formatEventTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && !error && (
        <div className="mt-4 grid grid-cols-2 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 sm:flex sm:justify-between">
          <p className="order-1 col-span-2 sm:order-none">Page {page} of {totalPages}</p>
          <div className="contents sm:flex sm:gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`order-3 sm:order-none ${pagerBtn}`}>Previous</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`order-4 sm:order-none ${pagerBtn}`}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
