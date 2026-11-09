'use client';

import type { FormEventHandler } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { StaffAuthFrame, StaffPasswordField, staffPrimary } from '@/components/auth/StaffAuth';

interface Values {
  password: string;
  confirmPassword: string;
}

interface Props {
  register: UseFormRegister<Values>;
  errors: FieldErrors<Values>;
  isLoading: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

/** The staff "Set your password" screen. The page owns the form, token and API logic; this only draws it. */
export default function SetupPasswordView({ register, errors, isLoading, onSubmit }: Props) {
  return (
    <StaffAuthFrame title="Set your password" intro="Create a secure password for your account.">
      <ul id="password-requirements" className="mb-6 list-disc space-y-1 pl-5 text-base text-[#5d5645]">
        <li>Minimum 8 characters</li>
        <li>At least one uppercase letter</li>
        <li>At least one lowercase letter</li>
        <li>At least one number or special character</li>
      </ul>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <StaffPasswordField
          label="New Password"
          id="setup-password"
          autoComplete="new-password"
          placeholder="••••••••"
          hintId="password-requirements"
          error={errors.password?.message}
          {...register('password')}
        />
        <StaffPasswordField
          label="Confirm Password"
          id="setup-confirm-password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <button type="submit" disabled={isLoading} className={staffPrimary}>
          {isLoading ? 'Setting password...' : 'Set Password'}
        </button>
      </form>
    </StaffAuthFrame>
  );
}
