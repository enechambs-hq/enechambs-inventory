"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Truck, CalendarClock } from "lucide-react";
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
}

export default function SummaryCards() {
  const router = useRouter();
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  const [supplierCount, setSupplierCount] = useState<number | null>(null);
  const [expiryCount, setExpiryCount] = useState<number | null>(null);

  useEffect(() => {
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
      label: "Categories",
      value: categoryCount,
      href: "/categories",
      linkLabel: "Manage",
      icon: Tag,
      iconBg: "bg-[#e8f5ee]",
      iconColor: "text-[#1a7a4a]",
      accent: "border-l-[#1a7a4a]",
    },
    {
      label: "Suppliers",
      value: supplierCount,
      href: "/suppliers",
      linkLabel: "Manage",
      icon: Truck,
      iconBg: "bg-teal-500/10",
      iconColor: "text-[#0d9488]",
      accent: "border-l-[#0d9488]",
    },
    {
      label: "Expiry Tracked",
      value: expiryCount,
      href: "/inventory",
      linkLabel: "View Inventory",
      icon: CalendarClock,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600",
      accent: "border-l-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map(({ label, value, href, linkLabel, icon: Icon, iconBg, iconColor, accent }) => (
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
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          )}
        </div>
      ))}
    </div>
  );
}
