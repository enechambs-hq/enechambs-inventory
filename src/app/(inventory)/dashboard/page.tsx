"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuthGuard } from "@/hooks/useAuthGuard";

import { ActivityLog, UserRole } from "@/types";
import { toast } from "sonner";
import { Package, ShoppingCart, Wallet, BarChart2 } from "lucide-react";
import {
  dashboardService,
  DashboardStats,
  RevenueDataPoint,
  StaffPerformance,
} from "@/lib/services/dashboard.sservice";

export default function DashboardPage() {
  useAuthGuard(UserRole.ADMIN);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>(
    [],
  );
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const fetchStats = async () => {
    try {
      const data = await dashboardService.getStats();
      setStats(data.data);
    } catch {
      toast.error("Failed to load stats");
    }
  };

  const fetchStaffPerformance = async () => {
    try {
      const data = await dashboardService.getStaffPerformance();
      setStaffPerformance(data.data);
    } catch {
      toast.error("Failed to load staff performance");
    }
  };

  const fetchRevenueChart = async () => {
    try {
      const data = await dashboardService.getRevenueChart(
        dateRange.startDate,
        dateRange.endDate,
      );
      setRevenueData(data.data);
    } catch {
      toast.error("Failed to load revenue data");
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const data = await dashboardService.getRecentActivity();
      setRecentActivity(data.data);
    } catch {
      toast.error("Failed to load recent activity");
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStats(),
        fetchStaffPerformance(),
        fetchRevenueChart(),
        fetchRecentActivity(),
      ]);
      setIsLoading(false);
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const doFetch = async () => {
      try {
        const data = await dashboardService.getRevenueChart(
          dateRange.startDate,
          dateRange.endDate,
        );
        setRevenueData(data.data);
      } catch {
        toast.error("Failed to load revenue data");
      }
    };
    doFetch();
  }, [dateRange.startDate, dateRange.endDate]);

  const statCards = stats
    ? [
        {
          label: "Total Inventory",
          value: stats.totalInventory,
          icon: Package,
        },
        {
          label: "Total Sales",
          value: stats.totalSales,
          icon: ShoppingCart,
        },
        {
          label: "Total Revenue",
          value: `₦${stats.totalRevenue.toLocaleString()}`,
          icon: Wallet,
        },
        {
          label: "Available Stock",
          value: stats.availableStock,
          icon: BarChart2,
        },
        {
          label: "Sold Stock",
          value: stats.soldStock,
          icon: BarChart2,
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Business overview and performance
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon size={16} className="text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold">Revenue Overview</h2>
          <div className="flex items-center gap-3">
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground">From</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground">To</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {revenueData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No revenue data for selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [
                  `₦${Number(value).toLocaleString()}`,
                  "Revenue",
                ]}
              />
              <Bar
                dataKey="totalRevenue"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Staff performance + Recent activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Staff performance */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Staff Performance</h2>
          {staffPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Name", "Sales", "Revenue", "Collections"].map((h) => (
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
                {staffPerformance.map((staff) => (
                  <tr
                    key={staff.userId}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2 font-medium">{staff.name}</td>
                    <td className="py-2">{staff.totalSales}</td>
                    <td className="py-2">
                      ₦{staff.totalRevenue.toLocaleString()}
                    </td>
                    <td className="py-2">{staff.totalCollections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.timestamp), "MMM d, yyyy · h:mm a")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
