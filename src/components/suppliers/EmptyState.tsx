import { Plus, Truck } from 'lucide-react';
import React from 'react';

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="relative w-20 h-20 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-6">
        <Truck size={32} className="text-[#1a7a4a]" />
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
          <Plus size={12} className="text-gray-500" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">No suppliers yet</h3>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        Suppliers are the vendors you source products from. Add your first supplier to start
        tracking where your stock comes from.
      </p>

      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors"
      >
        <Plus size={16} />
        Add your first supplier
      </button>
    </div>
  );
}

export default EmptyState;
