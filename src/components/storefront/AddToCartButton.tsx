'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import { btnPrimary, linkClass } from './ui';

export default function AddToCartButton({ slug, name, soldOut }: { slug: string; name: string; soldOut: boolean }) {
  const lines = useCart();
  const inCart = lines.find((l) => l.slug === slug)?.quantity ?? 0;
  const [message, setMessage] = useState<string | null>(null);

  if (soldOut) {
    return (
      <button type="button" disabled className={`${btnPrimary} w-full sm:w-auto`}>
        Sold out
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`${btnPrimary} w-full sm:w-auto`}
        onClick={() => {
          const result = cartActions.add(slug, name, 1);
          setMessage(
            result.ok ? null : result.reason === 'cart_full' ? 'Your cart is full. Remove something first.' : 'This combo could not be added.',
          );
        }}
      >
        {inCart > 0 ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
        {inCart > 0 ? 'Add another' : 'Add to cart'}
      </button>
      {inCart > 0 && (
        <p role="status" className="text-sm text-[#14693f]">
          {inCart} in your cart.{' '}
          <Link href="/cart" className={linkClass}>
            View cart
          </Link>
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm font-medium text-[#8a2a1d]">
          {message}
        </p>
      )}
    </div>
  );
}
