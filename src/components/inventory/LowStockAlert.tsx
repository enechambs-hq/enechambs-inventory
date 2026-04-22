'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { InventoryItem } from '@/types';

interface Props {
  items: InventoryItem[];
}

export default function LowStockAlert({ items }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (items.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/7 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {items.length} low stock {items.length === 1 ? 'alert' : 'alerts'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/12 text-amber-800 border border-amber-500/20"
                >
                  {item.productName} · {item.companyName} · {item.color}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-700/60 hover:text-amber-800 p-0.5 shrink-0 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
