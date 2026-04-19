'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { InventoryItem } from '@/types';

function itemLabel(item: InventoryItem): string {
  const identifier = item.imei || 'N/A';
  return `${item.productName} — ${item.color}, ${item.storageGB} · ${identifier}`;
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
    ? items.filter((i) => itemLabel(i).toLowerCase().includes(query.toLowerCase()))
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-left"
      >
        <span className={selected ? 'text-foreground truncate' : 'text-muted-foreground'}>
          {selected ? itemLabel(selected) : placeholder}
        </span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, IMEI…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-sm border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No items found</li>
            ) : (
              filtered.map((item) => (
                <li
                  key={item.id}
                  onMouseDown={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors ${
                    item.id === value ? 'bg-accent/50' : ''
                  }`}
                >
                  <span className="shrink-0 w-4">
                    {item.id === value && <Check size={12} className="text-primary" />}
                  </span>
                  <span>{itemLabel(item)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
