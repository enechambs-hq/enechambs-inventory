import { Plus, Tag } from 'lucide-react';
import React from 'react';

const SUGGESTED_STARTERS = [
  'Grains & Cereals',
  'Spices & Seasonings',
  'Oils & Fats',
  'Snacks',
  'Beverages',
  'Dried Fish',
];

function EmptyState({
  onAdd,
  onQuickAdd,
}: {
  onAdd: () => void;
  onQuickAdd: (name: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {/* Icon */}
      <div className="relative w-20 h-20 rounded-2xl bg-[#e8f5ee] flex items-center justify-center mb-6">
        <Tag size={32} className="text-[#1a7a4a]" />
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
          <Plus size={12} className="text-gray-500" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">No categories yet</h3>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        Categories help you sort foodstuff like grains, spices, and oils. Create your first one to
        start grouping products.
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-3 mb-10">
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a7a4a] text-white text-sm font-medium rounded-lg hover:bg-[#145c37] transition-colors"
        >
          <Plus size={16} />
          Add your first category
        </button>
      </div>

      {/* Divider */}
      <div className="w-full max-w-lg flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Suggested Starters
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Quick add chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTED_STARTERS.map((name) => (
          <button
            key={name}
            onClick={() => onQuickAdd(name)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-full hover:border-[#1a7a4a] hover:text-[#1a7a4a] hover:bg-[#e8f5ee] transition-colors"
          >
            <Plus size={13} />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmptyState;
