'use client';

import { Store, Truck } from 'lucide-react';
import type { FulfilmentMethod } from '@/lib/storefront/orders';
import { formatNaira } from '@/lib/storefront/catalogue';
import { Card } from './ui';

/** Delivery or pickup, as two large radio cards. Delivery shows its fee; pickup is free. */
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
    <Card>
      <h2 id="fulfilment-heading" className="text-lg font-bold text-[#0f4f2d]">How do you want your order?</h2>
      <div role="radiogroup" aria-labelledby="fulfilment-heading" className="mt-3 grid gap-3 sm:grid-cols-2">
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
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:opacity-60 ${
                selected ? 'border-[#0f4f2d] bg-[#e8f5ee] ring-1 ring-[#0f4f2d]' : 'border-[#d9ccaf] bg-white hover:bg-[#f6efe0]'
              }`}
            >
              <Icon size={20} aria-hidden="true" className={selected ? 'text-[#0f4f2d]' : 'text-[#8b7f6b]'} />
              <span>
                <span className="block text-sm font-bold text-[#0f4f2d]">{title}</span>
                <span className="block text-xs text-[#5d5645]">{detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
