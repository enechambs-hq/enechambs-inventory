"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { toast } from "sonner";
import { homeForRole } from "@/lib/nav-config";
import { StaffAuthFrame, StaffField, StaffPasswordField, staffPrimary } from "@/components/auth/StaffAuth";

// ─── Schema ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(homeForRole(user.role));
    }
  }, [isAuthenticated, user, router]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const response = await authService.login(data);
      setAuth(response.user, response.access_token);
      // redirect handled by useEffect watching isAuthenticated + user
    } catch (error) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = err.response?.data?.message || err.message || "Something went wrong";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StaffAuthFrame title="Staff sign in" intro="Sign in to manage your foodstuff inventory, sales and team.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <StaffField
          label="Email address"
          id="login-email"
          type="email"
          autoComplete="username"
          placeholder="adaeze@enechambs.ng"
          error={errors.email?.message}
          {...register("email")}
        />
        <StaffPasswordField
          label="Password"
          id="login-password"
          autoComplete="current-password"
          placeholder="••••••••••"
          error={errors.password?.message}
          {...register("password")}
        />
        <button type="submit" disabled={isLoading} className={staffPrimary}>
          {isLoading ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Signing in…
            </>
          ) : (
            "Sign in to Enechambs"
          )}
        </button>
        <p className="text-base text-[#5d5645]">Trouble signing in? Please contact your administrator.</p>
      </form>
    </StaffAuthFrame>
  );
}
