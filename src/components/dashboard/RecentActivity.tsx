import Link from "next/link";
import { format } from "date-fns";
import { ActivityLog } from "@/types";

interface Props {
  activities: ActivityLog[];
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500',
  LOGOUT: 'bg-gray-400',
  SALE: 'bg-blue-500',
  CREDIT: 'bg-purple-500',
  COLLECTION: 'bg-yellow-500',
  INVENTORY: 'bg-orange-500',
};

function dotColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-muted-foreground';
}

export default function RecentActivity({ activities }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Recent Activity</h2>
        <Link href="/activity" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      ) : (
        <ul className="space-y-4">
          {activities.slice(0, 5).map((log) => (
            <li key={log.id} className="flex gap-3">
              <div className="mt-1.5 shrink-0">
                <span className={`block h-2 w-2 rounded-full ${dotColor(log.action)}`} />
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
                <p className="text-xs font-medium">{log.action.replace(/_/g, ' ')}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{log.description}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(log.timestamp), "MMM d · h:mm a")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
