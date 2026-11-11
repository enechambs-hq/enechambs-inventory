'use client';

import { Check, Store, Truck } from 'lucide-react';
import type { FulfilmentMethod } from '@/lib/storefront/orders';
import { formatNaira } from '@/lib/storefront/catalogue';
import { checkoutFocus } from './CheckoutSection';

/**
 * Delivery or pickup, as two equal radio cards (stacked on phones, side by side
 * from 640px). Delivery shows its fee; pickup is free. It sits inside a checkout
 * section whose heading has the id "fulfilment-heading".
 */
export default function FulfilmentChoice({
  value,
  onChange,
  deliveryFee,
  disabled,
}: {
  value: FulfilmentMethod;
  onChange: (m: FulfilmentMethod) => void;
  deliveryFee: number | null;
  disabled?: boolean;
}) {
  const options: Array<{ method: FulfilmentMethod; title: string; detail: string; Icon: typeof Truck }> = [
    { method: 'delivery', title: 'Delivery', detail: deliveryFee === null ? 'Fee added at checkout' : `${formatNaira(deliveryFee)} delivery fee`, Icon: Truck },
    { method: 'pickup', title: 'Pickup', detail: 'Free. Collect from our store', Icon: Store },
  ];
  return (
    <div role="radiogroup" aria-labelledby="fulfilment-heading" className="grid gap-3 sm:grid-cols-2">
      {options.map(({ method, title, detail, Icon }) => {
        const selected = value === method;
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(method)}
            className={`flex min-h-[4.5rem] items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60 ${checkoutFocus} ${
              selected ? 'border-[#0f4f2d] bg-[#e8f5ee] ring-1 ring-[#0f4f2d]' : 'border-[#d9ccaf] bg-white hover:bg-[#f6efe0]'
            }`}
          >
            <Icon size={22} aria-hidden="true" className={`shrink-0 ${selected ? 'text-[#0f4f2d]' : 'text-[#5d5645]'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-[#0f4f2d]">{title}</span>
              <span className="block text-sm text-[#5d5645]">{detail}</span>
            </span>
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-[#0f4f2d] bg-[#0f4f2d] text-white' : 'border-[#d9ccaf] bg-white'}`}
            >
              {selected && <Check size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
