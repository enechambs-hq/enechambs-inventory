import { Search } from 'lucide-react';

type ActiveFilter = 'all' | 'available' | 'sold' | 'in-collection';

interface SearchState {
  productName: string;
  imei: string;
  companyName: string;
  color: string;
}

interface Props {
  activeFilter: ActiveFilter;
  search: SearchState;
  onFilterChange: (filter: ActiveFilter) => void;
  onSearchChange: (key: keyof SearchState, value: string) => void;
}

const FILTERS: { key: ActiveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'sold', label: 'Sold' },
  { key: 'in-collection', label: 'In Collection' },
];

const SEARCH_FIELDS: { key: keyof SearchState; placeholder: string }[] = [
  { key: 'productName', placeholder: 'Search product...' },
  { key: 'imei', placeholder: 'Search IMEI...' },
  { key: 'companyName', placeholder: 'Search company...' },
  { key: 'color', placeholder: 'Search color...' },
];

export default function InventoryFilters({ activeFilter, search, onFilterChange, onSearchChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
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

      {/* Search inputs */}
      <div className="grid grid-cols-4 gap-3">
        {SEARCH_FIELDS.map(({ key, placeholder }) => (
          <div key={key} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder={placeholder}
              value={search[key]}
              onChange={(e) => onSearchChange(key, e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
