"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Contact,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Tag,
  Truck,
  AlertTriangle,
  BarChart2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { UserRole } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9!@#$%^&*]/, "Must contain a number or special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const staffLinks = [
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/stock-alerts", label: "Stock Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: BarChart2 },
];

const adminLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ...staffLinks,
  { href: "/customers", label: "Customers", icon: Contact },
  { href: "/users", label: "Users", icon: Users },
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<ChangePasswordForm | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const links = user?.role === UserRole.ADMIN ? adminLinks : staffLinks;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(changePasswordSchema) });

  // Step 1: form submit → show confirmation modal
  const onChangePassword = (data: ChangePasswordForm) => {
    setPendingData(data);
    setChangePwOpen(false);
    setConfirmOpen(true);
  };

  // Step 2: confirmed → call API → logout
  const onConfirmChange = async () => {
    if (!pendingData) return;
    try {
      setIsSaving(true);
      await authService.changePassword({
        oldPassword: pendingData.currentPassword,
        newPassword: pendingData.newPassword,
        confirmNewPassword: pendingData.confirmPassword,
      });
      setConfirmOpen(false);
      reset();
      setPendingData(null);
      clearAuth();
      router.push('/login');
      toast.success("Password changed. Please sign in with your new password.");
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string | string[] } } })
        .response?.data?.message || "Something went wrong";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
      setConfirmOpen(false);
      setChangePwOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

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
    <>
      {/* Backdrop — tablet only, tap to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 lg:hidden z-40"
          onClick={onClose}
        />
      )}
    <aside
      className={`w-52 lg:w-64 h-screen fixed left-0 top-0 flex flex-col border-r bg-card z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <defs>
              <linearGradient id="sidebarBg" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#1a9155"/>
                <stop offset="1" stopColor="#0b3d22"/>
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="9" fill="url(#sidebarBg)"/>
            <ellipse cx="20" cy="3.5" rx="13" ry="5" fill="white" fillOpacity="0.07"/>
            {/* Spine */}
            <rect x="9" y="7" width="3.5" height="27" rx="1.75" fill="white"/>
            {/* Top arm */}
            <path d="M9 7H22C25 7 27 8.6 27 10.5C27 12.4 25 14 22 14H9V7Z" fill="white"/>
            {/* Middle arm */}
            <path d="M9 18H18C20.8 18 22.5 19.3 22.5 21C22.5 22.7 20.8 24 18 24H9V18Z" fill="white"/>
            {/* Bottom arm */}
            <path d="M9 27H22C25 27 27 28.6 27 30.5C27 32.4 25 34 22 34H9V27Z" fill="white"/>
            {/* Seed dots */}
            <circle cx="27" cy="10.5" r="2.2" fill="#a3f0c0" fillOpacity="0.9"/>
            <circle cx="22.5" cy="21" r="1.8" fill="#a3f0c0" fillOpacity="0.8"/>
            <circle cx="27" cy="30.5" r="2.2" fill="#a3f0c0" fillOpacity="0.9"/>
          </svg>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
              Enechambs
            </h1>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))] opacity-50 mt-0.5 tracking-wide uppercase">
              Food Inventory
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
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
              <span>{label}</span>
            </Link>
          ))}
      </nav>

      {/* User + Actions */}
      <div className="border-t px-3 py-3">
        {/* User info */}
        <div className="flex items-center gap-2.5 mb-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {user?.role}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => setChangePwOpen(true)}
            title="Change Password"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <KeyRound size={13} />
            <span>Password</span>
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Logout"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-red-500/8 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoggingOut ? (
              <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <LogOut size={13} />
            )}
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </div>
    </aside>

      {changePwOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100">
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <KeyRound size={15} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold leading-tight">Change Password</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Update your account password</p>
                </div>
              </div>
              <button
                onClick={() => { setChangePwOpen(false); reset(); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onChangePassword)} className="px-6 py-5 space-y-4">
              {[
                { field: "currentPassword" as const, label: "Current Password", show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
                { field: "newPassword" as const, label: "New Password", show: showNew, toggle: () => setShowNew((v) => !v) },
                { field: "confirmPassword" as const, label: "Confirm New Password", show: showConfirm, toggle: () => setShowConfirm((v) => !v) },
              ].map(({ field, label, show, toggle }) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-sm font-medium">{label}</label>
                  <div className="relative">
                    <input
                      {...register(field)}
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors[field] && (
                    <p className="text-[11px] text-destructive">{errors[field]?.message}</p>
                  )}
                </div>
              ))}

              <p className="text-[11px] text-muted-foreground pt-1">
                Min. 8 characters · uppercase · lowercase · number or symbol
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setChangePwOpen(false); reset(); }}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout warning confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100">
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm mx-4 shadow-2xl">
            <div className="px-6 pt-6 pb-5">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <KeyRound size={18} className="text-amber-500" />
              </div>
              <h2 className="text-[15px] font-bold">You'll be logged out</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Your password will be updated and you'll need to sign in again with your new password.
              </p>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => { setConfirmOpen(false); setChangePwOpen(true); }}
                disabled={isSaving}
                className="flex-1 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={onConfirmChange}
                disabled={isSaving}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Updating…
                  </span>
                ) : "Yes, Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
