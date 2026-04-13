'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/services/auth.service';
import { toast } from 'sonner';

const setupPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9!@#$%^&*]/, 'Must contain a number or special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SetupPasswordForm = z.infer<typeof setupPasswordSchema>;

export default function SetupPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
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
      router.push('/login');
      return;
    }
    authService
      .validateToken(token)
      .then(() => setIsValidToken(true))
      .catch(() => {
        toast.error('Invalid or expired link');
        router.push('/login');
      })
      .finally(() => setIsValidating(false));
  }, [token]);

  const onSubmit = async (data: SetupPasswordForm) => {
    if (!token) return;
    try {
      setIsLoading(true);
      await authService.setupPassword({ token, password: data.password });
      toast.success('Password set successfully. Please log in.');
      router.push('/login');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Validating link...</p>
      </div>
    );
  }

  if (!isValidToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-xl border bg-card shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Set your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a secure password for your account
          </p>
        </div>

        <ul className="text-xs text-muted-foreground mb-6 space-y-1">
          <li>• Minimum 8 characters</li>
          <li>• At least one uppercase letter</li>
          <li>• At least one lowercase letter</li>
          <li>• At least one number or special character</li>
        </ul>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">New Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Confirm Password</label>
            <input
              {...register('confirmPassword')}
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Setting password...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}butt