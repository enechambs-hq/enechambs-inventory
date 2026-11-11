'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';

/** The Enechambs logo mark (the same artwork the login page already used on phones). */
function LogoMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="staffLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#1a9155" />
          <stop offset="1" stopColor="#0b3d22" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#staffLogoBg)" />
      <ellipse cx="20" cy="3.5" rx="13" ry="5" fill="white" fillOpacity={0.07} />
      <rect x="9" y="7" width="3.5" height="27" rx="1.75" fill="white" />
      <path d="M9 7H22C25 7 27 8.6 27 10.5C27 12.4 25 14 22 14H9V7Z" fill="white" />
      <path d="M9 18H18C20.8 18 22.5 19.3 22.5 21C22.5 22.7 20.8 24 18 24H9V18Z" fill="white" />
      <path d="M9 27H22C25 27 27 28.6 27 30.5C27 32.4 25 34 22 34H9V27Z" fill="white" />
      <circle cx="27" cy="10.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
      <circle cx="22.5" cy="21" r="1.8" fill="#a3f0c0" fillOpacity={0.8} />
      <circle cx="27" cy="30.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
    </svg>
  );
}

interface FrameProps {
  title: string;
  intro: string;
  children: ReactNode;
}

/** One centred 448px column on a cream page: logo, "Staff portal" label, heading, intro, then the page content. */
export function StaffAuthFrame({ title, intro, children }: FrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#fbfaf6] text-[#1d2a22]">
      <main className="flex flex-1 justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[28rem]">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoMark />
            <p className="mt-2 text-lg font-bold tracking-tight">Enechambs</p>
            <p className="text-sm text-[#5d5645]">Food Inventory</p>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1a7a4a]">Staff portal</p>
          <h1 className="mt-2 text-[1.875rem] font-bold leading-9 tracking-tight text-[#0f4f2d] md:text-4xl md:leading-10">{title}</h1>
          <p className="mt-2 text-base text-[#5d5645]">{intro}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-sm text-[#5d5645]">© 2026 Enechambs</footer>
    </div>
  );
}

export const staffInput = (invalid: boolean) =>
  `block min-h-12 w-full rounded-xl border bg-white px-4 py-3 text-base text-[#1d2a22] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] ${
    invalid ? 'border-2 border-[#8a2a1d]' : 'border-[#d9ccaf]'
  }`;

export const staffPrimary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:cursor-not-allowed disabled:opacity-60';

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-sm font-medium text-[#8a2a1d]">
      {message}
    </p>
  ) : null;
}

type FieldProps = { label: string; id: string; error?: string; hintId?: string } & Omit<ComponentProps<'input'>, 'id' | 'className'>;

/** A labelled 48px text-style input with its error tied to it. */
export function StaffField({ label, id, error, hintId, ...input }: FieldProps) {
  const describedBy = [hintId, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={staffInput(!!error)} {...input} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** A labelled password input with a 48px "Show password" / "Hide password" control. Visibility only. */
export function StaffPasswordField({ label, id, error, hintId, ...input }: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const describedBy = [hintId, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${staffInput(!!error)} pr-14`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#5d5645] transition hover:text-[#0f4f2d] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1a7a4a]"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
