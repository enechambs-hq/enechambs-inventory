"use client";

import { useState } from "react";
import { CreditStats, CreditStatus } from "@/types";
import { creditsService } from "@/lib/services/credits.service";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  stats: CreditStats;
}

const STATUS_LABELS: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: "Pending",
  [CreditStatus.PARTIAL]: "Partial",
  [CreditStatus.PAID]: "Paid",
  [CreditStatus.OVERDUE]: "Overdue",
  [CreditStatus.DEFAULTED]: "Defaulted",
};

const STATUS_COLORS: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: "bg-yellow-500/10 text-yellow-600",
  [CreditStatus.PARTIAL]: "bg-blue-500/10 text-blue-600",
  [CreditStatus.PAID]: "bg-green-500/10 text-green-600",
  [CreditStatus.OVERDUE]: "bg-orange-500/10 text-orange-600",
  [CreditStatus.DEFAULTED]: "bg-red-500/10 text-red-600",
};

export default function CreditStatsCard({ stats }: Props) {
  const [checking, setChecking] = useState(false);

  const handleCheckOverdue = async () => {
    try {
      setChecking(true);
      const res = await creditsService.checkOverdue();
      toast.info(res.message ?? "Overdue check completed");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? "Failed to run overdue check";
      toast.warning(message);
    } finally {
      setChecking(false);
    }
  };

  const kpis = [
    { label: "Total Credits", value: stats.totalCredits },
    { label: "Total Amount", value: `₦${stats.totalCreditAmount.toLocaleString()}` },
    { label: "Total Paid", value: `₦${stats.totalPaid.toLocaleString()}` },
    { label: "Outstanding", value: `₦${stats.outstandingBalance.toLocaleString()}` },
    { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%` },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Credits</h2>
        <button
          onClick={handleCheckOverdue}
          disabled={checking}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          {checking ? "Checking..." : "Check Overdue"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          By Status
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(stats.byStatus) as [CreditStatus, number][]).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
              <span className="font-bold">{count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Overdue credits */}
      {stats.overdueCredits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Overdue
          </p>
          <div className="space-y-2">
            {stats.overdueCredits.map((credit) => (
              <div
                key={credit.id}
                className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-500/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{credit.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {credit.productName} · Due {format(new Date(credit.dueDate), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-orange-600">
                    ₦{Number(credit.remainingBalance).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">remaining</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
