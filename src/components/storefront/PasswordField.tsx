'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { inputClass } from './ui';

type Props = { label: string; hint?: string; error?: string | null; id: string } & Omit<ComponentProps<'input'>, 'type'>;

/** A password input with an eye button that shows or hides what was typed. Same look as `Field`. */
export default function PasswordField({ label, hint, error, id, ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-[#3b3a33]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} pr-11`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 mt-1 flex w-11 items-center justify-center rounded-r-xl text-[#8b7f6b] transition hover:text-[#0f4f2d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[#8b7f6b]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-[#8a2a1d]">
          {error}
        </p>
      )}
    </div>
  );
}
