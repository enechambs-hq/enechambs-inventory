"use client";

import { format, addDays, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RevenueDataPoint } from "@/lib/services/dashboard.service";

function fillRevenueGaps(
  data: RevenueDataPoint[],
  startDate: string,
  endDate: string
): RevenueDataPoint[] {
  const today = format(new Date(), "yyyy-MM-dd");
  const effectiveEnd = endDate > today ? today : endDate;
  const existing = new Map(data.map((d) => [d.date.slice(0, 10), d]));
  const result: RevenueDataPoint[] = [];
  let current = parseISO(startDate);
  const end = parseISO(effectiveEnd);
  while (current <= end) {
    const key = format(current, "yyyy-MM-dd");
    result.push(existing.get(key) ?? { date: key, total: "0" });
    current = addDays(current, 1);
  }
  return result;
}

interface Props {
  data: RevenueDataPoint[];
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export default function RevenueChart({ data, dateRange, onDateRangeChange }: Props) {
  const filledData = fillRevenueGaps(data, dateRange.startDate, dateRange.endDate);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Revenue Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Total revenue over selected period</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                onDateRangeChange({ ...dateRange, startDate: e.target.value })
              }
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                onDateRangeChange({ ...dateRange, endDate: e.target.value })
              }
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      {filledData.every((d) => Number(d.total) === 0) ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No revenue data for selected range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={filledData.map((d) => ({
              date: format(new Date(d.date), "MMM d"),
              Revenue: Number(d.total),
            }))}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#1a7a4a" stopOpacity={0.35} />
                <stop offset="40%"  stopColor="#1a7a4a" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#1a7a4a" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1000000
                  ? `₦${(v / 1000000).toFixed(1)}M`
                  : `₦${(v / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                // border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                fontSize: "12px",
                boxShadow: "0 4px 16px rgba(26,122,74,0.12)",
              }}
              formatter={(value) => [
                `₦${Number(value).toLocaleString()}`,
                "Revenue",
              ]}
              cursor={{ stroke: "#1a7a4a", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="Revenue"
              stroke="#1a7a4a"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "#1a7a4a", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}