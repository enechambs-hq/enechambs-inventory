import { ShoppingCart, Wallet, TrendingUp, BarChart3 } from "lucide-react";
import { DashboardStats } from "@/lib/services/dashboard.service";
import { MonthlySummary } from "@/types";

interface Props {
  stats: DashboardStats;
  monthly: MonthlySummary | null;
}

interface CardConfig {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  patternColor: string;
  stripColor: string;
}

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor, patternColor, stripColor }: CardConfig) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderTop: `3px solid ${stripColor}` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${patternColor} 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
          opacity: 0.15,
        }}
      />
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ backgroundColor: patternColor }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground leading-tight truncate pr-1">{label}</p>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function StatsCards({ stats, monthly }: Props) {
  const monthLabel = monthly?.period.month ?? "This Month";
  const loading = "—";

  const cards: CardConfig[] = [
    {
      label: "Available Now",
      value: String(stats.availableInventory),
      icon: TrendingUp,
      iconBg: "bg-[#e8f5ee]",
      iconColor: "text-[#1a7a4a]",
      valueColor: "text-foreground",
      patternColor: "#1a7a4a",
      stripColor: "#1a7a4a",
    },
    {
      label: "Monthly Sales",
      value: monthly ? String(monthly.sales.count) : loading,
      sub: monthLabel,
      icon: ShoppingCart,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600",
      valueColor: "text-green-600",
      patternColor: "#16a34a",
      stripColor: "#16a34a",
    },
    {
      label: "Monthly Revenue",
      value: monthly ? `₦${monthly.sales.revenue.toLocaleString()}` : loading,
      sub: monthLabel,
      icon: Wallet,
      iconBg: "bg-teal-500/10",
      iconColor: "text-[#0d9488]",
      valueColor: "text-[#0d9488]",
      patternColor: "#0d9488",
      stripColor: "#0d9488",
    },
    {
      label: "Monthly Profit",
      value: monthly ? `₦${monthly.sales.profit.toLocaleString()}` : loading,
      sub: monthly ? `${monthly.sales.profitMargin.toFixed(1)}% margin` : undefined,
      icon: BarChart3,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-700",
      valueColor: "text-green-700",
      patternColor: "#15803d",
      stripColor: "#15803d",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
