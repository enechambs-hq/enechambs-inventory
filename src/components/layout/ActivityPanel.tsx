'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';
import { formatActivityDescription } from '@/lib/utils';
import { useModalBehavior } from '@/hooks/useModalBehavior';
import { ActionTag } from '@/components/activity/ActivityParts';
import { format } from 'date-fns';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import { appErrorFromStaff } from '@/lib/errors/staff-adapter';
import type { AppError } from '@/lib/errors/app-error';
import { ACTIVITY_ADMIN_ONLY_MESSAGE } from '@/lib/admin/activity-access';
import { createLatest } from '@/lib/admin/latest';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The top-bar Activity button; focus returns to it when the panel closes. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Whether this person may read the activity log (administrators only, like the API). Without it nothing is requested. */
  canView: boolean;
}

export default function ActivityPanel({ open, onClose, triggerRef, canView }: Props) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehavior({ open, onClose, containerRef: panelRef, returnFocusRef: triggerRef });

  const [error, setError] = useState<AppError | null>(null);
  const latest = useRef(createLatest());

  const load = useCallback(() => {
    const ticket = latest.current.next();
    setIsLoading(true);
    setError(null);
    dashboardService
      .getRecentActivity(5)
      .then((rows) => {
        if (latest.current.isCurrent(ticket)) setActivities(rows);
      })
      .catch((err) => {
        // A failed request is not "no recent activity": say so, and never keep an earlier list on screen as if current.
        if (!latest.current.isCurrent(ticket)) return;
        setActivities([]);
        setError(appErrorFromStaff(err, { method: 'GET', action: 'load', what: 'recent activity' }));
      })
      .finally(() => {
        if (latest.current.isCurrent(ticket)) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    // Only people who may read the log ask for it; everyone else gets an explanation, not a request that would be refused.
    if (open && canView) load();
  }, [open, canView, load]);

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />}

      {/* Drawer: hidden and inert while closed, so nothing inside it is reachable by keyboard */}
      <div
        ref={panelRef}
        id="activity-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-panel-title"
        tabIndex={-1}
        inert={!open}
        className={`fixed right-0 top-0 z-50 flex h-dvh w-[22rem] max-w-[calc(100vw-1rem)] flex-col border-l border-gray-200 bg-white outline-none ease-in-out ${
          open ? 'translate-x-0 transition-transform duration-300' : 'invisible translate-x-full transition-[transform,visibility] duration-300'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
          <h2 id="activity-panel-title" className="text-lg font-semibold text-[#0f4f2d]">Recent Activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recent activity"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {!canView ? (
            <p role="status" className="py-3 text-base text-gray-700">{ACTIVITY_ADMIN_ONLY_MESSAGE}</p>
          ) : isLoading ? (
            <p className="py-3 text-base text-gray-600">Loading...</p>
          ) : error ? (
            <div className="py-3">
              <LoadErrorPanel error={error} onRetry={load} title="Could not load recent activity" />
            </div>
          ) : activities.length === 0 ? (
            <p className="py-3 text-base text-gray-600">No recent activity</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activities.map((log) => (
                <li key={log.id} className="min-w-0 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <ActionTag action={log.action} />
                    <p className="text-sm text-gray-600">{format(new Date(log.timestamp), 'MMM d · h:mm a')}</p>
                  </div>
                  {log.user && (
                    <p className="mt-2 break-words text-base font-semibold text-[#0f4f2d]">
                      {log.user.firstName} {log.user.lastName}
                      <span className="ml-1.5 text-sm font-normal capitalize text-gray-600">({log.user.role})</span>
                    </p>
                  )}
                  <p className="mt-1 break-words text-sm text-gray-800">{formatActivityDescription(log.description)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canView && (
        <div className="border-t border-gray-200 p-4">
          <Link
            href="/activity"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
          >
            View all activity
          </Link>
        </div>
        )}
      </div>
    </>
  );
}
