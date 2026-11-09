"use client";

import { Suspense, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/lib/services/auth.service";
import { toast } from "sonner";
import SetupPasswordView from "@/components/auth/SetupPasswordView";

const setupPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9!@#$%^&*]/, "Must contain a number or special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SetupPasswordForm = z.infer<typeof setupPasswordSchema>;

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupPasswordForm>({
    resolver: zodResolver(setupPasswordSchema),
  });

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    authService
      .validateToken(token)
      .then(() => setIsValidToken(true))
      .catch(() => {
        toast.error("Invalid or expired link");
        router.push("/login");
      })
      .finally(() => setIsValidating(false));
  }, [token, router]);

  const onSubmit = async (data: SetupPasswordForm) => {
    if (!token) return;
    try {
      setIsLoading(true);
      await authService.setupPassword({ token, password: data.password });
      toast.success("Password set successfully. Please log in.");
      router.push("/login");
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || "Something went wrong";
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#fbfaf6] px-4">
        <p role="status" className="text-base text-[#5d5645]">Validating link...</p>
      </div>
    );
  }

  if (!isValidToken) return null;

  return <SetupPasswordView register={register} errors={errors} isLoading={isLoading} onSubmit={handleSubmit(onSubmit)} />;
}

export default function SetupPasswordPage() {
  return (
    <Suspense>
      <SetupPasswordContent />
    </Suspense>
  );
}