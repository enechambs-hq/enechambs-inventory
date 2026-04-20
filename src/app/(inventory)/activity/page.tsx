'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { UserRole, ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';
import { toast } from 'sonner';
import { formatActivityDescription } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500/10 text-green-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  SALE: 'bg-blue-500/10 text-blue-700',
  CREDIT: 'bg-purple-500/10 text-purple-700',
  COLLECTION: 'bg-yellow-500/10 text-yellow-700',
  INVENTORY: 'bg-orange-500/10 text-orange-700',
};

function actionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-muted text-muted-foreground';
}

export default function ActivityPage() {
  useAuthGuard(UserRole.ADMIN);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const limit = 25;

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await dashboardService.getAllActivity(page, limit);
      setLogs(data.data);
      setTotal(data.meta.total);
      setTotalPages(data.meta.totalPages);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">{total} total events</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {['User', 'Role', 'Action', 'Description', 'Time'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <div className="flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No activity found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <span className="capitalize text-xs text-muted-foreground">{log.user.role}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionStyle(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {formatActivityDescription(log.description)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.timestamp), 'MMM d, yyyy · h:mm a')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <p className="text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md border disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-md border disabled:opacity-50 hover:bg-muted transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
