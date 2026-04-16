import { format } from "date-fns";
import { ActivityLog } from "@/types";

interface Props {
  activities: ActivityLog[];
}

export default function RecentActivity({ activities }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-base font-semibold mb-4">Recent Activity</h2>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      ) : (
        <ul className="space-y-3">
          {activities.slice(0, 8).map((log) => (
            <li key={log.id} className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">{log.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(log.timestamp), "MMM d, yyyy · h:mm a")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
