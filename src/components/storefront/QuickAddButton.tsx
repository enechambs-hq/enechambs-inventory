'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { cartActions, useCart } from '@/lib/storefront/cart-store';

const CONFIRM_MS = 1400;

/**
 * Cart icon on a combo card: adds one unit without leaving the page. It is a
 * sibling of the card's link (a button inside a link is invalid and would also
 * navigate). Shows a brief tick when added, and how many are in the cart.
 */
export default function QuickAddButton({ slug, name }: { slug: string; name: string }) {
  const inCart = useCart().find((l) => l.slug === slug)?.quantity ?? 0;
  const [justAdded, setJustAdded] = useState(false);
  const [full, setFull] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function add() {
    const result = cartActions.add(slug, name, 1);
    setJustAdded(result.ok);
    setFull(!result.ok && result.reason === 'cart_full');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setJustAdded(false);
      setFull(false);
    }, CONFIRM_MS);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={add}
        aria-label={inCart > 0 ? `Add another ${name} to cart (${inCart} in cart)` : `Add ${name} to cart`}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] ${
          justAdded ? 'border-[#0f4f2d] bg-[#0f4f2d] text-white' : 'border-[#d9ccaf] bg-white/95 text-[#0f4f2d] backdrop-blur hover:bg-[#e8f5ee]'
        }`}
      >
        {justAdded ? <Check size={20} aria-hidden="true" /> : <ShoppingCart size={20} aria-hidden="true" />}
      </button>
      {inCart > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#1a7a4a] px-1.5 text-[11px] font-bold leading-5 text-white ring-2 ring-white"
        >
          {inCart}
        </span>
      )}
      <span role="status" className="sr-only">
        {justAdded ? `${name} added to cart` : full ? 'Your cart is full' : ''}
      </span>
      {full && (
        <span aria-hidden="true" className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-[#2b2b28] px-2.5 py-1 text-xs font-medium text-white shadow-lg">
          Cart is full
        </span>
      )}
    </div>
  );
}
