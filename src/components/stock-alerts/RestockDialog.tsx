'use client';

import { useState } from 'react';
import { X, Check, Package } from 'lucide-react';
import { InventoryItem } from '@/types';
import { NumericInput } from '@/components/shared/NumericInput';

interface Props {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (newQty: number) => Promise<void>;
  isLoading: boolean;
}

export default function RestockDialog({ item, onClose, onConfirm, isLoading }: Props) {
  const defaultQty = item.restockThreshold * 2;
  const [qty, setQty] = useState(String(defaultQty));

  const handleConfirm = () => {
    const parsed = Number(qty);
    onConfirm(isNaN(parsed) || parsed <= 0 ? defaultQty : parsed);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-full bg-[#e8f5ee] border-4 border-[#f3f9f5] flex items-center justify-center shrink-0">
            <Check size={18} className="text-[#1a7a4a]" strokeWidth={2.2} />
          </div>
          <div className="flex-1 pt-0.5">
            <h2 className="text-base font-semibold text-gray-900">Mark as restocked?</h2>
            <p className="text-sm text-gray-500 mt-1 leading-snug">
              Confirm that{' '}
              <span className="font-semibold text-gray-800">{item.productName}</span> has been
              replenished. The alert will be cleared from this list.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Product summary */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f3f9f5] border border-[#d0e9da]">
            <div className="w-9 h-9 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
              <Package size={17} className="text-[#1a7a4a]" strokeWidth={1.7} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.category?.name ?? '—'} · {item.unit}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Current qty</p>
              <p className="text-sm font-semibold tabular-nums text-gray-800">
                {item.quantity} {item.unit}
              </p>
            </div>
          </div>
        </div>

        {/* New quantity */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Units to add
          </label>
          <NumericInput
            value={qty}
            onChange={(v) => setQty(v)}
            decimals={false}
            placeholder={`e.g. ${defaultQty}`}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5">How many units are you adding to the current stock?</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-9 px-4 rounded-lg bg-[#1a7a4a] text-white text-sm font-semibold hover:bg-[#145c37] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.2} />
                Confirm restock
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
