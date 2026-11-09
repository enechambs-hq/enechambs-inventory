import Link from 'next/link';
import type { PublicCombo } from '@/types/storefront';
import { isSoldOut } from '@/lib/storefront/catalogue';
import AvailabilityBadge from './AvailabilityBadge';
import Price from './Price';
import QuickAddButton from './QuickAddButton';
import SafeImage from './SafeImage';

/**
 * One combo in the grid: image, name, price and an Add to cart button. The
 * availability badge shows only when it matters (low stock). The title link
 * stretches over the whole card (a button cannot live inside a link) and the
 * button sits above it so adding does not open the combo.
 */
export default function ComboCard({ combo, priority = false }: { combo: PublicCombo; priority?: boolean }) {
  const first = combo.images[0];
  const soldOut = isSoldOut(combo);
  const lowStock = combo.availability.status === 'low_stock';
  return (
    <li className="group">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#eadfc8] bg-white transition-shadow hover:shadow-md has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#1a7a4a]">
        <div className="relative aspect-[4/3] overflow-hidden lg:aspect-square bg-[#f6efe0]">
          <SafeImage
            src={first?.url}
            alt={first?.altText || combo.name}
            priority={priority}
            className={`h-full w-full ${soldOut ? 'grayscale-[0.6] opacity-80' : ''}`}
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-[#1d2a22]">
            <Link href={`/combos/${combo.slug}`} className="outline-none after:absolute after:inset-0 after:content-['']">
              {combo.name}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Price price={combo.price} referencePrice={combo.referencePrice} />
            {lowStock && <AvailabilityBadge availability={combo.availability} />}
          </div>
          <div className="relative z-10 mt-auto">
            {soldOut ? (
              <p className="rounded-full bg-[#f1f1ef] px-4 py-2.5 text-center text-sm font-semibold text-[#5b5b57]">Sold out</p>
            ) : (
              <QuickAddButton slug={combo.slug} name={combo.name} />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
