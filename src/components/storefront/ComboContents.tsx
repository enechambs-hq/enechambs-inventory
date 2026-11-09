import type { PublicComboItem } from '@/types/storefront';
import { itemQuantity } from '@/lib/storefront/catalogue';

/**
 * "What's included": exactly what the customer receives, one item per line, the name on the left and the quantity on the right.
 * It sits above the description on purpose, so nobody has to read prose to find
 * out what they are buying. Items without a quantity show only the name. Renders
 * nothing (no empty heading) for a combo that has no items.
 */
export default function ComboContents({ items }: { items: PublicComboItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="combo-contents-heading" className="mt-8 border-t border-[#eadfc8] pt-6">
      <h2 id="combo-contents-heading" className="text-lg font-semibold text-[#0f4f2d]">
        What&apos;s included
      </h2>
      <ul className="mt-4 divide-y divide-[#f0e7d3] overflow-hidden rounded-2xl border border-[#eadfc8] bg-white">
        {items.map((item, index) => {
          const quantity = itemQuantity(item);
          return (
            <li key={`${index}-${item.name}`} className="flex items-baseline gap-3 px-4 py-3 leading-snug">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 self-start rounded-full bg-[#1a7a4a] mt-[0.55em]" />
              <span className="min-w-0 flex-1 break-words font-medium text-[#1d2a22]">{item.name}</span>
              {quantity && <span className="shrink-0 text-right text-[#5d5645]">{quantity}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
