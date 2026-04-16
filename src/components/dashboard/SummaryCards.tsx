"use client";

import { useRouter } from "next/navigation";
import { CollectionsStats, CreditStats, CreditStatus } from "@/types";

interface Props {
  collectionsStats: CollectionsStats | null;
  creditStats: CreditStats | null;
}

export default function SummaryCards({ collectionsStats, creditStats }: Props) {
  const router = useRouter();
  const overdue = creditStats?.byStatus[CreditStatus.OVERDUE] ?? 0;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Collections */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Collections</h2>
          <button
            onClick={() => router.push("/collections")}
            className="text-xs text-primary font-medium hover:underline"
          >
            View Collections
          </button>
        </div>
        {collectionsStats ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {collectionsStats.allTime.total}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {collectionsStats.allTime.paid}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {collectionsStats.allTime.pending}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>

      {/* Credits */}
      <div
        className={`rounded-2xl border border-border bg-card p-6 shadow-sm${
          overdue > 0 ? " border-l-4 border-l-orange-400" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Credits</h2>
          <button
            onClick={() => router.push("/credits")}
            className="text-xs text-primary font-medium hover:underline"
          >
            View Credits
          </button>
        </div>
        {creditStats ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {creditStats.totalCredits}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold text-foreground mt-1">
                ₦{creditStats.outstandingBalance.toLocaleString()}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">Overdue</p>
                {overdue > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-red-500/10 text-red-600 text-[10px] font-bold">
                    {overdue}
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-foreground mt-1">{overdue}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}
