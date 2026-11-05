'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { LogOut, Mail, MapPin, Phone, ReceiptText, UserRound } from 'lucide-react';
import type { CustomerProfile } from '@/lib/storefront/orders';

/**
 * The signed-in customer's profile icon. It opens a small panel with their
 * details, a link to their orders, and Sign out. Closes on Escape, on a click
 * outside, and when a link inside it is used.
 */
export default function ProfileMenu({ profile, onSignOut }: { profile: CustomerProfile; onSignOut: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your profile"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d9ccaf] bg-white text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
      >
        <UserRound size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Your profile"
          className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#eadfc8] bg-white p-4 shadow-[0_12px_24px_-12px_rgba(60,40,0,0.4)]"
        >
          <p className="break-words text-base font-bold text-[#0f4f2d]">{profile.name}</p>
          <dl className="mt-3 space-y-2 text-sm text-[#3b3a33]">
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 text-[#8b7f6b]">
                <Mail size={15} aria-hidden="true" />
                <span className="sr-only">Email</span>
              </dt>
              <dd className="min-w-0 break-all">{profile.email}</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="mt-0.5 text-[#8b7f6b]">
                <Phone size={15} aria-hidden="true" />
                <span className="sr-only">Phone</span>
              </dt>
              <dd>{profile.phone}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-1 border-t border-[#f1e9d6] pt-3">
            <Link
              href="/my-orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
            >
              <ReceiptText size={16} aria-hidden="true" />
              My orders
            </Link>
            <Link
              href="/account/addresses"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a]"
            >
              <MapPin size={16} aria-hidden="true" />
              Address book
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                setOpen(false);
                await onSignOut();
                setSigningOut(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold text-[#8a2a1d] transition hover:bg-[#fdf1ef] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
