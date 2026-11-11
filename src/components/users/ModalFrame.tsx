'use client';

import { useRef, type ReactNode } from 'react';
import { useModalBehavior } from '@/hooks/useModalBehavior';

interface Props {
  /** id of the element inside `children` that names the dialog. */
  labelledBy: string;
  onClose: () => void;
  canClose?: boolean;
  /** Tailwind max-width class for the card. */
  widthClass?: string;
  /** Makes the card a column whose own body scrolls (for long lists). */
  column?: boolean;
  children: ReactNode;
}

/**
 * The shared frame for the Users dialogs: dark backdrop, 16px screen gutters, a white bordered
 * card that scrolls when the screen is short, and dialog semantics with focus handling.
 * Mount it only while the dialog is open.
 */
export default function ModalFrame({ labelledBy, onClose, canClose = true, widthClass = 'max-w-md', column = false, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useModalBehavior({ open: true, onClose, containerRef: ref, canClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={canClose ? onClose : undefined} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative w-full ${widthClass} max-h-[calc(100dvh-2rem)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl outline-none sm:p-6 ${
          column ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
