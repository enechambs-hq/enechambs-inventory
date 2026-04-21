'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, ShoppingCart, CreditCard, Users, ClipboardList, X } from 'lucide-react';
import { dashboardService } from '@/lib/services/dashboard.service';

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; href: string }> = {
  inventory: { label: 'Inventory', icon: <Package size={14} />, color: 'text-blue-500 bg-blue-500/10', href: '/inventory' },
  sale:      { label: 'Sale',      icon: <ShoppingCart size={14} />, color: 'text-green-500 bg-green-500/10', href: '/sales' },
  credit:    { label: 'Credit',    icon: <CreditCard size={14} />, color: 'text-amber-500 bg-amber-500/10', href: '/credits' },
  customer:  { label: 'Customer',  icon: <Users size={14} />, color: 'text-purple-500 bg-purple-500/10', href: '/customers' },
  incoming_order: { label: 'Inquiry', icon: <ClipboardList size={14} />, color: 'text-rose-500 bg-rose-500/10', href: '/incoming-orders' },
};

function fallbackConfig(type: string) {
  return TYPE_CONFIG[type] ?? { label: type, icon: <Search size={14} />, color: 'text-muted-foreground bg-muted', href: '/' };
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (val.trim().length < 2) { setResults([]); setOpen(false); return; }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await dashboardService.globalSearch(val, 12);
        setResults(res.results);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
  };

  const handleSelect = (result: SearchResult) => {
    const config = fallbackConfig(result.type);
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(config.href);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Input */}
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search anything… (⌘K)"
          className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-all"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-2.5 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(grouped).map(([type, items]) => {
                const config = fallbackConfig(type);
                return (
                  <div key={type}>
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {config.label}s
                    </p>
                    {items.map((r) => (
                      <button
                        key={r.id}
                        onMouseDown={() => handleSelect(r)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
                      >
                        <span className={`mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${config.color}`}>
                          {config.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{r.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
