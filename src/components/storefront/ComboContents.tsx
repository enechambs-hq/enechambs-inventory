import type { PublicComboItem } from '@/types/storefront';
import { itemQuantity } from '@/lib/storefront/catalogue';

/**
 * "What's included": exactly what the customer receives, one item per line.
 * It sits above the description on purpose, so nobody has to read prose to find
 * out what they are buying. Items without a quantity show only the name. Renders
 * nothing (no empty heading) for a combo that has no items.
 */
export default function ComboContents({ items }: { items: PublicComboItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="combo-contents-heading" className="mt-7 border-t border-[#eadfc8] pt-6">
      <h2 id="combo-contents-heading" className="text-sm font-semibold uppercase tracking-wide text-[#8b7f6b]">
        What&apos;s included
      </h2>
      <ul className="mt-3 divide-y divide-[#f0e7d3] overflow-hidden rounded-2xl border border-[#eadfc8] bg-white">
        {items.map((item, index) => {
          const quantity = itemQuantity(item);
          return (
            <li key={`${index}-${item.name}`} className="flex items-baseline gap-3 px-4 py-3 leading-snug">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 self-start rounded-full bg-[#1a7a4a] mt-[0.55em]" />
              <span className="min-w-0 flex-1 break-words">
                <span className="font-medium text-[#1d2a22]">{item.name}</span>
                {quantity && <span className="text-[#5d5645]"> &mdash; {quantity}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
