'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * A closable frosted-glass modal for forms on phones. A native <dialog>, so
 * focus is trapped, the page behind is inert, Escape closes it and focus returns
 * to what opened it. The card scrolls when the form is taller than the screen.
 */
export default function AddressModal({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
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
      aria-labelledby={labelledBy}
      data-leaving={leaving ? '' : undefined}
      className="ene-modal m-auto w-[calc(100%-1.5rem)] max-w-md p-0 text-[#1d2a22]"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ene-modal-card relative max-h-[88dvh] overflow-y-auto rounded-3xl border border-white/70 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_30px_60px_-24px_rgba(15,79,45,0.55)] backdrop-blur-2xl backdrop-saturate-150">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5d5645] transition hover:bg-white/70 hover:text-[#0f4f2d] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="pr-8">{children}</div>
      </div>
    </dialog>
  );
}
