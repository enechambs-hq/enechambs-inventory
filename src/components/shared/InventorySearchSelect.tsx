'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { InventoryItem } from '@/types';
import { formatUnit } from '@/lib/formatUnit';

function itemSearchText(item: InventoryItem): string {
  return `${item.productName} ${item.unit}`.toLowerCase();
}

interface Props {
  items: InventoryItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function InventorySearchSelect({
  items,
  value,
  onChange,
  disabled,
  placeholder = 'Select an item',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value);

  const filtered = query.trim()
    ? items.filter((i) => itemSearchText(i).includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-left gap-2"
      >
        {selected ? (
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{selected.productName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {formatUnit(selected.quantity, selected.unit)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or unit…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-sm border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">No items found</li>
            ) : (
              filtered.map((item) => {
                const isSelected = item.id === value;
                return (
                  <li
                    key={item.id}
                    onMouseDown={() => { onChange(item.id); setOpen(false); setQuery(''); }}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Check column */}
                    <span className="shrink-0 w-4 flex justify-center">
                      {isSelected && <Check size={13} className="text-primary" />}
                    </span>

                    {/* Item info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatUnit(item.quantity, item.unit)} · ₦{item.sellingPrice.toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
