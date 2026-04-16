"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DailySummary, WeeklySummary, MonthlySummary } from "@/types";

interface Props {
  daily: DailySummary | null;
  weekly: WeeklySummary | null;
  monthly: MonthlySummary | null;
}

type PeriodTab = "daily" | "weekly" | "monthly";

export default function PeriodOverview({ daily, weekly, monthly }: Props) {
  const [periodTab, setPeriodTab] = useState<PeriodTab>("daily");

  const data = periodTab === "daily" ? daily : periodTab === "weekly" ? weekly : monthly;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-foreground">Sales Overview</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["daily", "weekly", "monthly"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPeriodTab(tab)}
              className={
                periodTab === tab
                  ? "bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  : "text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              }
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <PeriodContent data={data} />
      )}
    </div>
  );
}

function PeriodContent({ data }: { data: DailySummary | WeeklySummary | MonthlySummary }) {
  const { sales } = data;
  const breakdown = "dailyBreakdown" in data ? data.dailyBreakdown : null;
  const profitMargin =
    "profitMargin" in sales ? (sales as MonthlySummary["sales"]).profitMargin : null;

  const salesCards = [
    { label: "Count", value: sales.count },
    { label: "Revenue", value: `₦${sales.revenue.toLocaleString()}` },
    { label: "Cost", value: `₦${sales.cost.toLocaleString()}` },
    { label: "Profit", value: `₦${sales.profit.toLocaleString()}` },
    {
      label: profitMargin != null ? "Margin" : "Avg Sale",
      value:
        profitMargin != null
          ? `${profitMargin.toFixed(1)}%`
          : `₦${sales.averageSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        {salesCards.map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {breakdown && breakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Daily Breakdown
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={breakdown.map((d) => ({
                date: format(new Date(d.date), "MMM d"),
                Revenue: Number(d.revenue),
                Cost: Number(d.cost),
              }))}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => `₦${Number(value).toLocaleString()}`}
              />
              <Area
                type="monotone"
                dataKey="Revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="Cost"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                fill="url(#costGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "hsl(var(--muted-foreground))", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
