"use client";

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
import { RevenueDataPoint } from "@/lib/services/dashboard.service";

interface Props {
  data: RevenueDataPoint[];
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export default function RevenueChart({ data, dateRange, onDateRangeChange }: Props) {
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

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No revenue data for selected range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data.map((d) => ({
              date: format(new Date(d.date), "MMM d"),
              Revenue: Number(d.total),
            }))}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.4}  />
                <stop offset="40%"  stopColor="#3b82f6" stopOpacity={0.2}  />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity={0}    />
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
                // borderLeft: "3px solid #2563eb",
                borderRadius: "10px",
                fontSize: "12px",
                boxShadow: "0 4px 16px rgba(37,99,235,0.12)",
              }}
              formatter={(value) => [
                `₦${Number(value).toLocaleString()}`,
                "Revenue",
              ]}
              cursor={{ stroke: "#5d8df4", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="Revenue"
              stroke="#1b1a1b"
              strokeWidth={0}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}