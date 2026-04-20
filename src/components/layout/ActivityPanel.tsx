'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';
import { formatActivityDescription } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500',
  LOGOUT: 'bg-gray-400',
  SALE: 'bg-blue-500',
  CREDIT: 'bg-purple-500',
  COLLECTION: 'bg-yellow-500',
  INVENTORY: 'bg-orange-500',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-muted-foreground';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ActivityPanel({ open, onClose }: Props) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    dashboardService
      .getRecentActivity(5)
      .then(setActivities)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-card border-l z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Recent Activity</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <ul className="space-y-4">
              {activities.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <div className="mt-1 flex-shrink-0">
                    <span className={`block h-2 w-2 rounded-full ${actionColor(log.action)}`} />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    {log.user && (
                      <p className="text-sm font-medium truncate">
                        {log.user.firstName} {log.user.lastName}
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal capitalize">
                          ({log.user.role})
                        </span>
                      </p>
                    )}
                    <p className="text-xs font-medium text-foreground">
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{formatActivityDescription(log.description)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), 'MMM d · h:mm a')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t">
          <Link
            href="/activity"
            onClick={onClose}
            className="block w-full text-center text-sm font-medium text-primary hover:underline"
          >
            View all activity
          </Link>
        </div>
      </div>
    </>
  );
}
