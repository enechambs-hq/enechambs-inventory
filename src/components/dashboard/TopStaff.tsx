"use client";

import { useRouter } from "next/navigation";
import { UserPerformance } from "@/types";

interface Props {
  performance: UserPerformance[];
}

export default function TopStaff({ performance }: Props) {
  const router = useRouter();

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Top Staff</h2>
        <button
          onClick={() => router.push("/users?tab=performance")}
          className="text-xs text-primary hover:underline"
        >
          View all
        </button>
      </div>

      {performance.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data available</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["Name", "Sales", "Revenue"].map((h) => (
                <th
                  key={h}
                  className="pb-2 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {performance.map((staff) => (
              <tr
                key={staff.user_id}
                onClick={() => router.push("/users?tab=performance")}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <td className="py-2 font-medium">
                  {staff.user_firstName} {staff.user_lastName}
                </td>
                <td className="py-2">{staff.totalsales}</td>
                <td className="py-2">₦{Number(staff.totalrevenue).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
