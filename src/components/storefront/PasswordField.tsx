'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

type Props = { label: string; hint?: string; error?: string | null; id: string } & Omit<ComponentProps<'input'>, 'type'>;

/**
 * A password input with an eye button that shows or hides what was typed.
 * Large presentation (16px text, 48px tall, 48px button); used only by the sign-in and registration forms.
 */
export default function PasswordField({ label, hint, error, id, ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-base font-semibold text-[#1d2a22]">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`block min-h-12 w-full scroll-mt-28 rounded-xl border bg-white py-3 pl-4 pr-12 text-base text-[#1d2a22] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] ${
            error ? 'border-2 border-[#8a2a1d]' : 'border-[#d9ccaf]'
          }`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#5d5645] transition hover:text-[#0f4f2d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-[#5d5645]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-base font-medium text-[#8a2a1d]">
          {error}
        </p>
      )}
    </div>
  );
}
