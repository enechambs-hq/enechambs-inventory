'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
}

interface Options {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  /** Where focus goes on close. Defaults to whatever had focus when the modal opened. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** False while an action is running, so Escape cannot dismiss it half-way. */
  canClose?: boolean;
}

/**
 * Modal behaviour shared by the admin dialogs and the Activity panel: focus moves in when it
 * opens, Tab stays inside, Escape closes (unless `canClose` is false), the page behind does not
 * scroll, and focus returns to the trigger on close. Presentation/accessibility only.
 */
export function useModalBehavior({ open, onClose, containerRef, returnFocusRef, canClose = true }: Options) {
  const closeRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  useEffect(() => {
    closeRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    if (!open) return;
    const initiator = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const root = containerRef.current;
      (focusables(root)[0] ?? root)?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (canCloseRef.current) {
          e.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(containerRef.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = containerRef.current?.contains(active) ?? false;
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Read at close time on purpose: the trigger is a stable element that must receive focus back.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const target = returnFocusRef?.current ?? initiator;
      if (target && target.isConnected) target.focus();
    };
  }, [open, containerRef, returnFocusRef]);
}
