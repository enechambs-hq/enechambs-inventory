"use client";

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

type ActiveFilter = 'all' | 'available' | 'sold' | 'in-collection';

interface Props {
  activeFilter: ActiveFilter;
  searchQuery: string;
  onFilterChange: (filter: ActiveFilter) => void;
  onSearchChange: (value: string) => void;
}

const FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'sold', label: 'Sold' },
  { key: 'in-collection', label: 'In Collection' },
];

const PLACEHOLDERS = ['product...', 'company...', 'color...'];

export default function InventoryFilters({ activeFilter, searchQuery, onFilterChange, onSearchChange }: Props) {
  const [phIndex, setPhIndex] = useState(0);
  const [phVisible, setPhVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setPhVisible(false);
      setTimeout(() => {
        setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setPhVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      {/* Filter tabs + search on same row */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeFilter === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Single animated search */}
        <div className="relative w-64 mb-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
        {!searchQuery && (
          <span className="absolute left-8 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none flex items-center gap-1">
            Search by{' '}
            <span className={`transition-opacity duration-300 ${phVisible ? 'opacity-100' : 'opacity-0'}`}>
              {PLACEHOLDERS[phIndex]}
            </span>
          </span>
        )}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-transparent"
        />
        </div>
      </div>
    </div>
  );
}
