import { CreditStats, CreditStatus } from "@/types";
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
  [CreditStatus.PENDING]: "text-yellow-600 bg-yellow-50",
  [CreditStatus.PARTIAL]: "text-blue-600 bg-blue-50",
  [CreditStatus.PAID]: "text-green-600 bg-green-50",
  [CreditStatus.OVERDUE]: "text-orange-600 bg-orange-50",
  [CreditStatus.DEFAULTED]: "text-red-600 bg-red-50",
};

export default function CreditStatsCard({ stats }: Props) {
  const kpis = [
    { label: "Total Credits", value: stats.totalCredits },
    { label: "Total Amount", value: `₦${stats.totalCreditAmount.toLocaleString()}` },
    { label: "Total Paid", value: `₦${stats.totalPaid.toLocaleString()}` },
    { label: "Outstanding", value: `₦${stats.outstandingBalance.toLocaleString()}` },
    { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%` },
  ];

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <h2 className="text-base font-semibold">Credits</h2>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Overdue
          </p>
          <div className="space-y-2">
            {stats.overdueCredits.map((credit) => (
              <div
                key={credit.id}
                className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{credit.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {credit.productName} · Due {format(new Date(credit.dueDate), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-orange-700">
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
