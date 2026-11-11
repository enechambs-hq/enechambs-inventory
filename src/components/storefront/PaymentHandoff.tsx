'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { btnPrimary } from './ui';

const SHOW_AFTER_MS = 300;
const SLOW_AFTER_MS = 15000;

/**
 * Shown while the order is placed and the payment page is being opened, so the
 * customer can see something is happening. It appears only if the wait lasts
 * more than a moment (no flash on a fast response), blocks the page behind it,
 * and cannot be dismissed. If it drags on, it offers the order page instead:
 * by then the order exists and the cart has been spent.
 */
export default function PaymentHandoff({ orderNumber, onShown }: { orderNumber?: string; onShown?: (shown: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // Lets the page know while the dialog is on screen (the mobile payment bar hides meanwhile). Timing is unchanged.
  useEffect(() => {
    if (!visible) return;
    onShown?.(true);
    return () => onShown?.(false);
  }, [visible, onShown]);

  useEffect(() => {
    const show = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const late = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(late);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (element?.open) element.close();
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <dialog
      ref={dialog}
      aria-label="Opening payment"
      className="ene-modal m-auto w-[calc(100%-2rem)] max-w-xs p-0 text-[#1d2a22]"
      // Not dismissible: Escape must not close it while the hand-over is in progress.
      onCancel={(e) => e.preventDefault()}
    >
      <div
        role="status"
        className="ene-modal-card relative overflow-hidden rounded-3xl border border-white/70 bg-white/55 p-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_30px_60px_-24px_rgba(15,79,45,0.55)] backdrop-blur-2xl backdrop-saturate-150"
      >
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#f2b84b]/45 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-[#1a7a4a]/30 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/10 to-transparent" />
        <div className="relative flex flex-col items-center gap-3">
          {slow ? (
            <>
              <p className="text-base font-bold text-[#0f4f2d]">This is taking longer than usual.</p>
              <Link href={orderNumber ? `/my-orders/${orderNumber}` : '/my-orders'} className={`${btnPrimary} w-full`}>
                {orderNumber ? 'Go to my order' : 'Go to my orders'}
              </Link>
            </>
          ) : (
            <>
              <Loader2 size={30} className="animate-spin text-[#0f4f2d]" aria-hidden="true" />
              <p className="text-base font-bold text-[#0f4f2d]">Opening secure payment…</p>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
