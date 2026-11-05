import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** Shared look for the customer pages (the same palette as the catalogue). */
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#0f4f2d] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#14693f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-full border border-[#d9ccaf] bg-white px-5 py-2.5 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:cursor-not-allowed disabled:opacity-50';
export const linkClass = 'font-medium text-[#1a7a4a] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
export const inputClass =
  'mt-1 block w-full rounded-xl border border-[#d9ccaf] bg-white px-3.5 py-2.5 text-sm text-[#1d2a22] placeholder:text-[#a79d86] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] disabled:opacity-60';

export function PageShell({ title, children, narrow = false }: { title: string; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-8 sm:px-6 sm:py-10 ${narrow ? 'max-w-md' : 'max-w-4xl'}`}>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#0f4f2d]">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#eadfc8] bg-white p-5 shadow-[0_12px_24px_-20px_rgba(60,40,0,0.5)] ${className}`}>{children}</div>;
}

type Tone = 'error' | 'info' | 'success' | 'warn';
const TONES: Record<Tone, string> = {
  error: 'border-[#e4b4ae] bg-[#fdf1ef] text-[#8a2a1d]',
  info: 'border-[#cfe3d6] bg-[#eef7f1] text-[#14693f]',
  success: 'border-[#b9dcc6] bg-[#e5f4ea] text-[#0f4f2d]',
  warn: 'border-[#ecd9a4] bg-[#fdf6dc] text-[#7a5a0c]',
};

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, hint, error, id, ...input }: { label: string; hint?: string; error?: string | null; id: string } & ComponentProps<'input'>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-[#3b3a33]">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...input} />
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

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-[#5d5645]">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-[#cfe3d6] border-t-[#1a7a4a]" />
      {label}…
    </p>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${linkClass} text-sm`}>
      {children}
    </Link>
  );
}
