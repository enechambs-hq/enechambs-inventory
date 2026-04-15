"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { ActivityLog, UserRole, RegisterStaffDto, UserPerformance } from "@/types";
import { toast } from "sonner";
import { Package, ShoppingCart, Wallet, BarChart2, UserPlus } from "lucide-react";
import {
  dashboardService,
  DashboardStats,
  RevenueDataPoint,
} from "@/lib/services/dashboard.service";
import { usersService } from "@/lib/services/users.service";
import { authService } from "@/lib/services/auth.service";

const registerStaffSchema = z.object({
  email: z.email("Invalid email address"),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  role: z.enum([UserRole.ADMIN, UserRole.STAFF]),
});

type RegisterStaffForm = z.output<typeof registerStaffSchema>;

export default function DashboardPage() {
  useAuthGuard(UserRole.ADMIN);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const {
    register: registerField,
    handleSubmit: handleRegisterSubmit,
    reset: resetRegisterForm,
    formState: { errors: registerErrors },
  } = useForm<RegisterStaffForm>({
    resolver: zodResolver(registerStaffSchema),
    defaultValues: { role: UserRole.STAFF },
  });

  const handleRegisterStaff = async (data: RegisterStaffDto) => {
    try {
      setIsRegistering(true);
      await authService.registerStaff(data);
      toast.success(`Staff account created. A setup email has been sent to ${data.email}.`);
      setRegisterModalOpen(false);
      resetRegisterForm();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || 'Failed to register staff';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsRegistering(false);
    }
  };

  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<UserPerformance[]>([]);
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
      setStats(data);
    } catch {
      toast.error("Failed to load stats");
    }
  };

  const fetchStaffPerformance = async () => {
    try {
      const data = await usersService.getPerformance();
      const top2 = [...data]
        .sort((a, b) => Number(b.totalrevenue) - Number(a.totalrevenue))
        .slice(0, 2);
      setStaffPerformance(top2);
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
      setRevenueData(data);
    } catch {
      toast.error("Failed to load revenue data");
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const data = await dashboardService.getRecentActivity();
      setRecentActivity(data);
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
        setRevenueData(data);
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
          value: `₦${(stats.totalRevenue ?? 0).toLocaleString()}`,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Business overview and performance
          </p>
        </div>
        <button
          onClick={() => setRegisterModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={16} />
          Register Staff
        </button>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Top Staff</h2>
            <button
              onClick={() => router.push('/users?tab=performance')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {staffPerformance.length === 0 ? (
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
                {staffPerformance.map((staff) => (
                  <tr
                    key={staff.user_id}
                    onClick={() => router.push('/users?tab=performance')}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2 font-medium">
                      {staff.user_firstName} {staff.user_lastName}
                    </td>
                    <td className="py-2">{staff.totalsales}</td>
                    <td className="py-2">
                      ₦{Number(staff.totalrevenue).toLocaleString()}
                    </td>
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
      {/* Register Staff Modal — admin only */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-card rounded-xl border p-6 w-full max-w-md">
            {isRegistering && (
              <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium">Registering staff...</span>
                </div>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-1">Register Staff</h2>
            <p className="text-sm text-muted-foreground mb-5">
              A setup email will be sent to the provided address.
            </p>
            <form
              onSubmit={handleRegisterSubmit(handleRegisterStaff)}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <input
                  {...registerField('email')}
                  type="email"
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {registerErrors.email && (
                  <p className="text-xs text-destructive">{registerErrors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    {...registerField('firstName')}
                    type="text"
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {registerErrors.firstName && (
                    <p className="text-xs text-destructive">{registerErrors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    {...registerField('lastName')}
                    type="text"
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {registerErrors.lastName && (
                    <p className="text-xs text-destructive">{registerErrors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Role</label>
                <select
                  {...registerField('role')}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={UserRole.STAFF}>Staff</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setRegisterModalOpen(false); resetRegisterForm(); }}
                  className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isRegistering ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
