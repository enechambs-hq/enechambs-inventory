'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { cartUnits } from '@/lib/storefront/cart';
import { useCart } from '@/lib/storefront/cart-store';
import ProfileMenu from './ProfileMenu';
import { useSession } from './use-session';
import { useStaffRole } from './use-staff-role';

const pill =
  'whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] sm:px-4';

/** Cart count and account links. A client island inside the server-rendered header. */
export default function HeaderActions() {
  const lines = useCart();
  const units = cartUnits(lines);
  // The header persists across client-side navigation, so ask again whenever the page changes
  // (signing in or registering ends with a navigation).
  const pathname = usePathname();
  const session = useSession(pathname);
  const staff = useStaffRole(pathname);
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link href="/cart" className={`${pill} relative inline-flex items-center gap-1.5`} aria-label={units > 0 ? `Cart, ${units} item${units === 1 ? '' : 's'}` : 'Cart'}>
        <ShoppingBag size={18} aria-hidden="true" />
        <span className="hidden sm:inline">Cart</span>
        {units > 0 && (
          <span data-testid="cart-count" className="ml-0.5 rounded-full bg-[#0f4f2d] px-2 py-0.5 text-[11px] font-bold text-white">
            {units}
          </span>
        )}
      </Link>
      {session.status === 'signed_in' ? (
        <ProfileMenu
          profile={session.profile}
          onSignOut={async () => {
            await session.signOut();
            router.push('/combos');
            router.refresh();
          }}
        />
      ) : (session.status === 'signed_out' || session.status === 'unavailable') && staff.status === 'known' ? (
        // A staff or admin session in this browser: show the way into the admin console, not the customer sign-in.
        staff.role ? (
          <Link href="/login" className={pill}>
            {staff.role === 'admin' ? 'Admin sign in' : 'Staff sign in'}
          </Link>
        ) : (
          <Link href="/account/login" className={pill}>
            Sign in
          </Link>
        )
      ) : (
        <span className="h-9 w-16" aria-hidden="true" />
      )}
    </div>
  );
}
