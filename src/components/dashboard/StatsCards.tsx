import { ShoppingCart, Wallet, TrendingUp, BarChart3 } from "lucide-react";
import { DashboardStats } from "@/lib/services/dashboard.service";
import { MonthlySummary } from "@/types";
import { StatCard } from "@/components/shared/StatCard";

interface Props {
  stats: DashboardStats;
  monthly: MonthlySummary | null;
}

export default function StatsCards({ stats, monthly }: Props) {
  const monthLabel = monthly?.period.month ?? "This Month";
  const loading = "—";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        label="Available Now"
        value={String(stats.availableInventory)}
        icon={TrendingUp}
        accentColor="#1a7a4a"
        iconBg="bg-[#e8f5ee]"
        iconColor="text-[#1a7a4a]"
      />
      <StatCard
        label="Monthly Sales"
        value={monthly ? String(monthly.sales.count) : loading}
        sub={monthLabel}
        icon={ShoppingCart}
        accentColor="#16a34a"
        iconBg="bg-green-500/10"
        iconColor="text-green-600"
      />
      <StatCard
        label="Monthly Revenue"
        value={monthly ? `₦${monthly.sales.revenue.toLocaleString()}` : loading}
        sub={monthLabel}
        icon={Wallet}
        accentColor="#0d9488"
        iconBg="bg-teal-500/10"
        iconColor="text-[#0d9488]"
      />
      <StatCard
        label="Monthly Profit"
        value={monthly ? `₦${monthly.sales.profit.toLocaleString()}` : loading}
        sub={monthly ? `${monthly.sales.profitMargin.toFixed(1)}% margin` : undefined}
        icon={BarChart3}
        accentColor="#15803d"
        iconBg="bg-green-500/10"
        iconColor="text-green-700"
      />
    </div>
  );
}
