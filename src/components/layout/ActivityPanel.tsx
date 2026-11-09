'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { ActivityLog } from '@/types';
import { dashboardService } from '@/lib/services/dashboard.service';
import { formatActivityDescription } from '@/lib/utils';
import { useModalBehavior } from '@/hooks/useModalBehavior';
import { ActionTag } from '@/components/activity/ActivityParts';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The top-bar Activity button; focus returns to it when the panel closes. */
  triggerRef?: RefObject<HTMLElement | null>;
}

export default function ActivityPanel({ open, onClose, triggerRef }: Props) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehavior({ open, onClose, containerRef: panelRef, returnFocusRef: triggerRef });

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
          {isLoading ? (
            <p className="py-3 text-base text-gray-600">Loading...</p>
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

        <div className="border-t border-gray-200 p-4">
          <Link
            href="/activity"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
          >
            View all activity
          </Link>
        </div>
      </div>
    </>
  );
}
