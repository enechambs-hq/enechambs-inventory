import { Package, ShoppingCart, Wallet, BarChart2 } from "lucide-react";
import { DashboardStats } from "@/lib/services/dashboard.service";

interface Props {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label: "Total Inventory", value: stats.totalInventory, icon: Package },
    { label: "Total Sales", value: stats.totalSales, icon: ShoppingCart },
    { label: "Total Revenue", value: `₦${(stats.totalRevenue ?? 0).toLocaleString()}`, icon: Wallet },
    { label: "Available Stock", value: stats.availableInventory, icon: BarChart2 },
    { label: "Collections", value: stats.totalCollections, icon: BarChart2 },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Icon size={16} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}
