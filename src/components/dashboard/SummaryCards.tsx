"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Tag, Truck, CalendarClock } from "lucide-react";
import { categoriesService } from "@/lib/services/categories.service";
import { suppliersService } from "@/lib/services/suppliers.service";
import { inventoryService } from "@/lib/services/inventory.service";

interface SummaryMetric {
  label: string;
  value: number | null;
  href: string;
  linkLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  accent: string;
  warning?: boolean;
}

export default function SummaryCards() {
  const router = useRouter();
  const [lowStock, setLowStock] = useState<number | null>(null);
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [supplierCount, setSupplierCount] = useState<number | null>(null);
  const [expiryCount, setExpiryCount] = useState<number | null>(null);

  useEffect(() => {
    inventoryService.getLowStockAlerts()
      .then((items) => setLowStock(items.length))
      .catch(() => setLowStock(0));

    categoriesService.getAll()
      .then((items) => setCategoryCount(items.length))
      .catch(() => setCategoryCount(0));

    suppliersService.getAll()
      .then((items) => setSupplierCount(items.length))
      .catch(() => setSupplierCount(0));

    inventoryService.getAll({ expiryTracking: true, limit: 1 })
      .then((res) => setExpiryCount(res.meta.total))
      .catch(() => setExpiryCount(0));
  }, []);

  const metrics: SummaryMetric[] = [
    {
      label: "Low Stock",
      value: lowStock,
      href: "/stock-alerts",
      linkLabel: "View Alerts",
      icon: AlertTriangle,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      accent: "border-l-amber-400",
      warning: (lowStock ?? 0) > 0,
    },
    {
      label: "Categories",
      value: categoryCount,
      href: "/categories",
      linkLabel: "Manage",
      icon: Tag,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      accent: "border-l-blue-400",
    },
    {
      label: "Suppliers",
      value: supplierCount,
      href: "/suppliers",
      linkLabel: "Manage",
      icon: Truck,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600",
      accent: "border-l-green-400",
    },
    {
      label: "Expiry Tracked",
      value: expiryCount,
      href: "/inventory",
      linkLabel: "View Inventory",
      icon: CalendarClock,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
      accent: "border-l-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(({ label, value, href, linkLabel, icon: Icon, iconBg, iconColor, accent, warning }) => (
        <div
          key={label}
          className={`rounded-2xl border border-border bg-card p-5 shadow-sm border-l-4 ${accent}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon size={16} className={iconColor} />
            </div>
            <button
              onClick={() => router.push(href)}
              className="text-xs text-primary font-medium hover:underline shrink-0"
            >
              {linkLabel}
            </button>
          </div>
          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
          {value === null ? (
            <div className="h-7 w-12 rounded-md bg-muted animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold tracking-tight ${warning ? "text-amber-600" : "text-foreground"}`}>
              {value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
