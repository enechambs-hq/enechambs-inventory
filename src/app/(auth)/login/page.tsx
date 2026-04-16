"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { toast } from "sonner";
import { UserRole } from "@/types";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(
        user.role === UserRole.ADMIN ? "/dashboard" : "/inventory"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const response = await authService.login(data);
      setAuth(response.user, response.access_token);

      if (response.user.role === UserRole.ADMIN) {
        router.push("/dashboard");
      } else {
        router.push("/inventory");
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || "Invalid credentials";
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — brand */}
      <div className="hidden md:flex md:w-1/2 bg-primary flex-col justify-between p-10 lg:p-14">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-black text-base">L</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Lmart
          </span>
        </div>

        {/* Center content */}
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
              Manage your business
              <br />
              with confidence.
            </h2>
            <p className="text-white/70 text-sm lg:text-base max-w-xs">
              Track inventory, record sales, manage collections and monitor your
              team — all in one place.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              "Inventory Tracking",
              "Sales Records",
              "Collections",
              "Staff Management",
            ].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium backdrop-blur-sm border border-white/10"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-white/40 text-xs">
          © {new Date().getFullYear()} Lmart. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:px-10 lg:px-16 bg-background">
        {/* Mobile logo */}
        <div className="flex flex-col items-center mb-8 md:hidden">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
            <span className="text-primary-foreground font-black text-xl">
              L
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Lmart
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Management System
          </p>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            Having trouble?{" "}
            <span className="text-primary font-medium cursor-pointer hover:underline">
              Contact your administrator
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}