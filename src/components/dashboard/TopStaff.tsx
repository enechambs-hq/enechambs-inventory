'use client';

import { useRouter } from 'next/navigation';
import { UserPerformance } from '@/types';
import { TrendingUp } from 'lucide-react';

interface Props {
  performance: UserPerformance[];
}

export default function TopStaff({ performance }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-foreground">Top Staff</h2>
        <button
          onClick={() => router.push('/users?tab=performance')}
          className="text-xs text-primary font-medium hover:underline"
        >
          View all
        </button>
      </div>

      {/* Empty state */}
      {performance.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {performance.map((staff, index) => (
            <div
              key={staff.user_id}
              onClick={() => router.push('/users?tab=performance')}
              className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 hover:bg-accent transition-colors cursor-pointer"
            >
              {/* Rank */}
              <div className="w-6 shrink-0 text-center">
                {index === 0 ? (
                  <TrendingUp size={14} className="text-primary mx-auto" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {staff.user_firstName?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {staff.user_firstName} {staff.user_lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {staff.totalsales} sale{Number(staff.totalsales) !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Revenue */}
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">
                  ₦{Number(staff.totalrevenue).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}