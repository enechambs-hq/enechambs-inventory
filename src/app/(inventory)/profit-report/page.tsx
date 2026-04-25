"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { UserRole, ProfitReport } from "@/types";
import { dashboardService } from "@/lib/services/dashboard.service";
import { toast } from "sonner";

const defaultRange = {
  startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function ProfitReportPage() {
  useAuthGuard(UserRole.ADMIN);

  const [report, setReport] = useState<ProfitReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState(defaultRange);

  const fetchReport = async (range = dateRange) => {
    try {
      setIsLoading(true);
      const data = await dashboardService.getProfitReport(range.startDate, range.endDate);
      setReport(data);
    } catch {
      toast.error("Failed to load profit report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateChange = (field: "startDate" | "endDate", value: string) => {
    const updated = { ...dateRange, [field]: value };
    setDateRange(updated);
    fetchReport(updated);
  };

  const s = report?.summary;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profit Report</h1>
          <p className="text-sm text-muted-foreground">Revenue, cost and profit breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateChange("startDate", e.target.value)}
              className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateChange("endDate", e.target.value)}
              className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      ) : !report ? null : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Revenue" value={`₦${s!.totalRevenue.toLocaleString()}`} />
            <StatCard label="Total Cost" value={`₦${s!.totalCost.toLocaleString()}`} />
            <StatCard
              label="Total Profit"
              value={`₦${s!.totalProfit.toLocaleString()}`}
              sub={`${s!.profitMargin.toFixed(2)}% margin`}
            />
            <StatCard label="Total Sales" value={s!.totalSales.toLocaleString()} />
            <StatCard label="Average Sale" value={`₦${s!.averageSale.toLocaleString()}`} />
          </div>

          {/* By Product */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-base font-semibold mb-4">By Product</h2>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["#", "Product", "Revenue", "Cost", "Profit", "Margin"].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.byProduct.map((p, i) => {
                  const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <tr key={p.productName} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 font-medium">{p.productName}</td>
                      <td className="py-2.5">₦{p.revenue.toLocaleString()}</td>
                      <td className="py-2.5">₦{p.cost.toLocaleString()}</td>
                      <td className="py-2.5">₦{p.profit.toLocaleString()}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(margin, 100).toFixed(1)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* By Staff */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-base font-semibold mb-4">By Staff</h2>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Staff", "Sales", "Revenue", "Cost", "Profit"].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.byStaff.map((s) => (
                  <tr key={s.staffName} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-medium">{s.staffName}</td>
                    <td className="py-2.5">{s.totalSales}</td>
                    <td className="py-2.5">₦{s.revenue.toLocaleString()}</td>
                    <td className="py-2.5">₦{s.cost.toLocaleString()}</td>
                    <td className="py-2.5">₦{s.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
