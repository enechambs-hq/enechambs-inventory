"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { UserRole, UserPerformance, DailySummary, WeeklySummary, MonthlySummary, TopProduct } from "@/types";
import type { ActivityLog } from "@/types";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { dashboardService, DashboardStats, RevenueDataPoint } from "@/lib/services/dashboard.service";
import { usersService } from "@/lib/services/users.service";

import StatsCards from "@/components/dashboard/StatsCards";
import SummaryCards from "@/components/dashboard/SummaryCards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import PeriodOverview from "@/components/dashboard/PeriodOverview";
import TopStaff from "@/components/dashboard/TopStaff";
import TopProducts from "@/components/dashboard/TopProducts";
import RecentActivity from "@/components/dashboard/RecentActivity";
import RegisterStaffModal from "@/components/dashboard/RegisterStaffModal";

export default function DashboardPage() {
  useAuthGuard(UserRole.ADMIN);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<UserPerformance[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const fetchRevenueChart = async (range = dateRange) => {
    try {
      const data = await dashboardService.getRevenueChart(range.startDate, range.endDate);
      setRevenueData(data);
    } catch {
      // fail silently;
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      await Promise.all([
        dashboardService.getStats().then(setStats).catch(() => {}),
        usersService.getPerformance()
          .then((data) => setStaffPerformance(
            [...data].sort((a, b) => Number(b.totalrevenue) - Number(a.totalrevenue)).slice(0, 2)
          ))
          .catch(() => {}),
        dashboardService.getDaily().then(setDaily).catch(() => {}),
        dashboardService.getWeekly().then(setWeekly).catch(() => {}),
        dashboardService.getMonthly().then(setMonthly).catch(() => {}),
        dashboardService.getTopProducts().then(setTopProducts).catch(() => {}),
        dashboardService.getRecentActivity(15).then(setRecentActivities).catch(() => {}),
      ]);
      setIsLoading(false);
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRevenueChart(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <button
          onClick={() => setRegisterModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          style={{ boxShadow: "0 4px 12px rgba(26,122,74,0.3)" }}
        >
          <UserPlus size={16} />
          Register Staff
        </button>
      </div>

      {stats && <StatsCards stats={stats} monthly={monthly} />}
      <RevenueChart data={revenueData} dateRange={dateRange} onDateRangeChange={setDateRange} />
      <SummaryCards />
      <PeriodOverview daily={daily} weekly={weekly} monthly={monthly} />

      <TopProducts products={topProducts} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopStaff performance={staffPerformance} />
        <RecentActivity activities={recentActivities} />
      </div>

      <RegisterStaffModal open={registerModalOpen} onClose={() => setRegisterModalOpen(false)} />
    </div>
  );
}
