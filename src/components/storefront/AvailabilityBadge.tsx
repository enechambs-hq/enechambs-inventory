import type { PublicAvailability } from '@/types/storefront';

const STYLES = {
  available: 'bg-[#e8f5ee] text-[#14693f] ring-[#b9e0c9]',
  low_stock: 'bg-[#fff3d6] text-[#8a5a00] ring-[#f3d58a]',
  sold_out: 'bg-[#f1f1ef] text-[#5b5b57] ring-[#d9d9d4]',
} as const;

const DOT = {
  available: 'bg-[#1a9155]',
  low_stock: 'bg-[#e0a21b]',
  sold_out: 'bg-[#8b8b85]',
} as const;

/** Shows the API's own label ("Available", "Only 7 left", "Sold Out"). */
export default function AvailabilityBadge({ availability }: { availability: PublicAvailability }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[availability.status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[availability.status]}`} aria-hidden="true" />
      {availability.label}
    </span>
  );
}
