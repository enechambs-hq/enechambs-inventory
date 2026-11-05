'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { loginHref, registerHref } from '@/lib/storefront/redirects';
import { btnPrimary, btnSecondary } from './ui';

/**
 * "Sign in to continue" as a modal: a frosted-glass card that animates in over
 * a blurred backdrop. A native <dialog>, so focus is trapped, the page behind is
 * inert, Escape closes it and focus returns to what opened it. The cart is kept;
 * `next` brings the visitor back after signing in or registering.
 */
export default function SignInModal({ next, reason, onClose }: { next: string; reason: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (element?.open) element.close();
    };
  }, []);

  const close = useCallback(() => {
    if (leaving) return;
    // Close the dialog before it unmounts so the browser returns focus to what opened it.
    const finish = () => {
      dialog.current?.close();
      onClose();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
    setLeaving(true);
    window.setTimeout(finish, 180);
  }, [leaving, onClose]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="sign-in-modal-title"
      aria-describedby="sign-in-modal-reason"
      data-leaving={leaving ? '' : undefined}
      className="ene-modal m-auto w-[calc(100%-2rem)] max-w-md p-0 text-[#1d2a22]"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // A click on the backdrop lands on the dialog element itself, not on the card inside it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ene-modal-card relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_30px_60px_-24px_rgba(15,79,45,0.55)] backdrop-blur-2xl backdrop-saturate-150 sm:p-7">
        {/* Soft colour orbs and a sheen under the glass give it the liquid look. */}
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#f2b84b]/45 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-[#1a7a4a]/30 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/10 to-transparent" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5d5645] transition hover:bg-white/70 hover:text-[#0f4f2d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="relative">
          <h2 id="sign-in-modal-title" className="pr-8 text-xl font-extrabold tracking-tight text-[#0f4f2d]">
            Sign in to continue
          </h2>
          <p id="sign-in-modal-reason" className="mt-2 text-sm leading-relaxed text-[#3b3a33]">
            {reason} Your cart will be waiting for you.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={loginHref(next)} autoFocus className={`${btnPrimary} w-full sm:w-auto`}>
              Sign in
            </Link>
            <Link href={registerHref(next)} className={`${btnSecondary} w-full bg-white/70 sm:w-auto`}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </dialog>
  );
}
