import { Package, ShoppingCart, Wallet, AlertTriangle, TrendingUp } from "lucide-react";
import { DashboardStats } from "@/lib/services/dashboard.service";

interface Props {
  stats: DashboardStats;
}

const cards = [
  {
    label: "Total Inventory",
    value: (s: DashboardStats) => String(s.totalInventory),
    icon: Package,
    iconBg: "bg-[#e8f5ee]",
    iconColor: "text-[#1a7a4a]",
    valueColor: "text-foreground",
    patternColor: "#1a7a4a",
    stripColor: "#1a7a4a",
  },
  {
    label: "Total Sales",
    value: (s: DashboardStats) => String(s.totalSales),
    icon: ShoppingCart,
    iconBg: "bg-green-500/10",
    iconColor: "text-green-600",
    valueColor: "text-green-600",
    patternColor: "#16a34a",
    stripColor: "#16a34a",
  },
  {
    label: "Total Revenue",
    value: (s: DashboardStats) => `₦${(s.totalRevenue ?? 0).toLocaleString()}`,
    icon: Wallet,
    iconBg: "bg-teal-500/10",
    iconColor: "text-[#0d9488]",
    valueColor: "text-[#0d9488]",
    patternColor: "#0d9488",
    stripColor: "#0d9488",
  },
  {
    label: "Available Now",
    value: (s: DashboardStats) => String(s.availableInventory),
    icon: TrendingUp,
    iconBg: "bg-[#e8f5ee]",
    iconColor: "text-[#1a7a4a]",
    valueColor: "text-foreground",
    patternColor: "#1a7a4a",
    stripColor: "#1a7a4a",
  },
  {
    label: "Stock Alerts",
    value: (s: DashboardStats) => String(s.lowStockAlerts ?? 0),
    icon: AlertTriangle,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600",
    valueColor: "text-amber-600",
    patternColor: "#d97706",
    stripColor: "#d97706",
  },
];

export default function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor, patternColor, stripColor }) => (
        <div
          key={label}
          className="relative rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          style={{ borderTop: `3px solid ${stripColor}` }}
        >
          {/* Dot pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, ${patternColor} 1px, transparent 1px)`,
              backgroundSize: "18px 18px",
              opacity: 0.15,
            }}
          />

          {/* Corner glow */}
          <div
            className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20"
            style={{ backgroundColor: patternColor }}
          />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground leading-tight truncate">
                {label}
              </p>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
              >
                <Icon size={16} className={iconColor} />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
              {value(stats)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}