"use client";

import { Suspense, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { toast } from "sonner";
import { homeForRole } from "@/lib/nav-config";
import { SESSION_EXPIRED_REASON, safeReturnPath } from "@/lib/auth/return-path";
import { StaffAuthFrame, StaffField, StaffPasswordField, staffPrimary } from "@/components/auth/StaffAuth";

// ─── Schema ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to go after signing in (validated: only an in-app path is ever used) and whether the last session just ended.
  const returnTo = safeReturnPath(searchParams.get("next"));
  const sessionEnded = searchParams.get("reason") === SESSION_EXPIRED_REASON;
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // Someone already signed in is sent on. Not after a session ended: if a saved credential somehow survived the cleanup,
  // sending them on would bounce them straight back here.
  useEffect(() => {
    if (isAuthenticated && user && !sessionEnded) {
      router.replace(returnTo ?? homeForRole(user.role));
    }
  }, [isAuthenticated, user, router, returnTo, sessionEnded]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const response = await authService.login(data);
      setAuth(response.user, response.access_token);
      router.replace(returnTo ?? homeForRole(response.user.role));
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
        {sessionEnded && (
          <p role="status" className="rounded-xl border border-[#e6d9b8] bg-[#fbf6e9] px-4 py-3 text-base text-[#5d5645]">
            Your session has ended. Please sign in again to continue.
          </p>
        )}
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
