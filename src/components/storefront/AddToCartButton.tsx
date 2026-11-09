'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, CreditCard, ShoppingBag } from 'lucide-react';
import { cartActions, useCart } from '@/lib/storefront/cart-store';
import SignInModal from './SignInModal';
import { linkClass } from './ui';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const action = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`;
const primary = `${action} bg-[#0f4f2d] text-white shadow-sm hover:bg-[#14693f]`;
const secondary = `${action} border border-[#1a7a4a] bg-white text-[#0f4f2d] hover:bg-[#e8f5ee]`;
import { useSession } from './use-session';

export default function AddToCartButton({ slug, name, soldOut }: { slug: string; name: string; soldOut: boolean }) {
  const lines = useCart();
  const inCart = lines.find((l) => l.slug === slug)?.quantity ?? 0;
  const [message, setMessage] = useState<string | null>(null);
  const [askToSignIn, setAskToSignIn] = useState(false);
  const session = useSession();
  const router = useRouter();

  if (soldOut) {
    return (
      <button type="button" disabled className={primary}>
        Sold out
      </button>
    );
  }

  function add(): boolean {
    const result = cartActions.add(slug, name, 1);
    setMessage(
      result.ok ? null : result.reason === 'cart_full' ? 'Your cart is full. Remove something first.' : 'This combo could not be added.',
    );
    return result.ok;
  }

  /** Buy now: make sure the combo is in the cart (without stacking another unit), then check out. A visitor without an account is asked, in a modal, to sign in or register first; the cart is kept. */
  function buyNow() {
    if (session.status === 'loading') return;
    if (inCart === 0 && !add()) return;
    if (session.status === 'signed_out') {
      setAskToSignIn(true);
      return;
    }
    router.push('/checkout');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={primary} onClick={add}>
          {inCart > 0 ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
          {inCart > 0 ? 'Add another' : 'Add to cart'}
        </button>
        <button type="button" className={secondary} disabled={session.status === 'loading'} onClick={buyNow}>
          <CreditCard size={18} aria-hidden="true" />
          Buy now
        </button>
      </div>
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
      {askToSignIn && session.status === 'signed_out' && (
        <SignInModal next="/checkout" reason="You need an account to place an order." onClose={() => setAskToSignIn(false)} />
      )}
    </div>
  );
}
