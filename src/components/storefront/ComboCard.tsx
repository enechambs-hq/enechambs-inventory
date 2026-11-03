import Link from 'next/link';
import type { PublicCombo } from '@/types/storefront';
import { isSoldOut } from '@/lib/storefront/catalogue';
import AvailabilityBadge from './AvailabilityBadge';
import Price from './Price';
import SafeImage from './SafeImage';

/** One combo in the grid. Shows only public fields; links by slug. */
export default function ComboCard({ combo, priority = false }: { combo: PublicCombo; priority?: boolean }) {
  const first = combo.images[0];
  const soldOut = isSoldOut(combo);
  return (
    <li className="group">
      <Link
        href={`/combos/${combo.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-[#eadfc8] bg-white shadow-[0_1px_0_#fff_inset,0_12px_30px_-18px_rgba(60,40,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(60,40,0,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f6efe0]">
          <SafeImage
            src={first?.url}
            alt={first?.altText || combo.name}
            priority={priority}
            className={`h-full w-full transition duration-500 group-hover:scale-105 ${soldOut ? 'grayscale-[0.6] opacity-80' : ''}`}
          />
          {soldOut && (
            <span className="absolute left-3 top-3 rounded-full bg-[#2b2b28]/85 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Sold Out
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="text-base font-semibold leading-snug text-[#1d2a22]">{combo.name}</h3>
          <div className="mt-auto flex items-end justify-between gap-3">
            <Price price={combo.price} referencePrice={combo.referencePrice} />
            <AvailabilityBadge availability={combo.availability} />
          </div>
        </div>
      </Link>
    </li>
  );
}
