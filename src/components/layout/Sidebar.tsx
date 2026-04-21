"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  CreditCard,
  Users,
  TrendingUp,
  Contact,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { UserRole } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCreditNotificationStore } from "@/store/creditNotification.store";

const staffLinks = [
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/collections", label: "Collections", icon: Wallet },
  { href: "/credits", label: "Credits", icon: CreditCard },
  { href: "/incoming-orders", label: "Incoming Orders", icon: ClipboardList },
];

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ...staffLinks,
  { href: "/customers", label: "Customers", icon: Contact },
  { href: "/users", label: "Users", icon: Users },
  { href: "/profit-report", label: "Profit Report", icon: TrendingUp },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const overdueCount = useCreditNotificationStore((s) => s.overdueCount);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const links = user?.role === UserRole.ADMIN ? adminLinks : staffLinks;

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.logout();
    } catch {
      // fail silently, clear anyway
    } finally {
      clearAuth();
      router.push("/login");
      toast.success("Logged out successfully");
    }
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col border-r bg-card">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-black text-sm">
              L
            </span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Lmart
            </h1>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] opacity-60 -mt-0.5">
              Management System
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isCredits = href === '/credits';
          const showBadge = isCredits && overdueCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.1] active:scale-[0.98]",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span
                  className="ml-auto min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: 'var(--warning)', color: 'var(--warning-foreground)' }}
                >
                  {overdueCount > 99 ? '99+' : overdueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t">
        <div className="mb-3 px-2">
          <p className="text-sm font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {user?.role}
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoggingOut ? (
            <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <LogOut size={16} />
          )}
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
