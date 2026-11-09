import type { ReactNode } from 'react';

/** Shared focus ring for the checkout controls. */
export const checkoutFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';

/** A checkout form section: a numbered 18px heading and a simple bordered panel. The number is a plain label, not a step. */
export function CheckoutSection({ number, id, title, children }: { number: number; id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-[#eadfc8] bg-white/70 p-4 sm:p-6">
      <h2 id={id} className="flex items-center gap-3 text-lg font-semibold text-[#0f4f2d]">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f6efe0] text-sm font-bold text-[#0f4f2d]">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
