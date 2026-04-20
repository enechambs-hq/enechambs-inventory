import Link from 'next/link';
import { format } from 'date-fns';
import { ActivityLog } from '@/types';
import { formatActivityDescription } from '@/lib/utils';

interface Props {
  activities: ActivityLog[];
}

const ACTION_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  LOGIN:      { dot: 'bg-green-500',  bg: 'bg-green-500/10',  text: 'text-green-700'  },
  LOGOUT:     { dot: 'bg-slate-400',  bg: 'bg-slate-100',     text: 'text-slate-500'  },
  SALE:       { dot: 'bg-primary',    bg: 'bg-primary/10',    text: 'text-primary'    },
  CREDIT:     { dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-700' },
  COLLECTION: { dot: 'bg-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-700' },
  INVENTORY:  { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-700' },
};

function getActionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) =>
    action.toUpperCase().includes(k)
  );
  return key ? ACTION_COLORS[key] : { dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground' };
}

export default function RecentActivity({ activities }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
        <Link
          href="/activity"
          className="text-xs text-primary font-medium hover:underline"
        >
          View all
        </Link>
      </div>

      {/* Empty state */}
      {activities.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activities.slice(0, 5).map((log) => {
            const style = getActionStyle(log.action);
            return (
              <div
                key={log.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors"
              >
                {/* Dot */}
                <div className="mt-1 shrink-0">
                  <span className={`block h-2 w-2 rounded-full ${style.dot}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {log.user && (
                        <p className="text-sm font-semibold text-foreground truncate">
                          {log.user.firstName} {log.user.lastName}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground capitalize">
                            ({log.user.role})
                          </span>
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/70 shrink-0">
                      {format(new Date(log.timestamp), 'MMM d · h:mm a')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
                    >
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate">
                    {formatActivityDescription(log.description)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}