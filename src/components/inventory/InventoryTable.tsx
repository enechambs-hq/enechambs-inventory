import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { InventoryItem, UserRole } from '@/types';

interface Props {
  items: InventoryItem[];
  isLoading: boolean;
  userRole?: UserRole;
  collectionSerials: Set<string>;
  page: number;
  totalPages: number;
  total: number;
  showPagination: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
}

const COLOR_MAP: Record<string, string> = {
  black: '#1e293b', midnight: '#1e293b', titanium: '#78716c',
  white: '#f1f5f9', porcelain: '#f1f5f9', gold: '#d97706',
  blue: '#3b82f6', pink: '#ec4899', orange: '#ea580c',
  mars: '#ea580c', green: '#16a34a', purple: '#9333ea',
  gray: '#64748b', grey: '#64748b', silver: '#94a3b8',
  navy: '#1e3a5f', red: '#dc2626',
};

function getColorDot(colorName: string): string {
  const lower = colorName.toLowerCase();
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return '#64748b';
}

const HEADERS_BASE = ['Product', 'IMEI', 'Company', 'Color', 'Storage', 'Selling Price', 'Status'];

export default function InventoryTable({
  items,
  isLoading,
  userRole,
  collectionSerials,
  page,
  totalPages,
  total,
  showPagination,
  onEdit,
  onDelete,
  onPageChange,
}: Props) {
  const isAdmin = userRole === UserRole.ADMIN;
  const headers = isAdmin ? [...HEADERS_BASE, 'Actions'] : HEADERS_BASE;
  const colSpan = headers.length;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                    i === 0 ? 'rounded-tl-2xl' : i === headers.length - 1 ? 'rounded-tr-2xl' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center">
                  <div className="flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No products found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const inCollection = collectionSerials.has(item.imei);
                return (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3.5 py-3 font-semibold text-[13.5px]">{item.productName}</td>
                    <td className="px-3.5 py-3">
                      <span className="font-mono text-xs text-muted-foreground tracking-wide">
                        {item.imei || '—'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-muted-foreground">{item.companyName || '—'}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: getColorDot(item.color) }}
                        />
                        <span className="text-muted-foreground text-[13px]">{item.color}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-medium">
                        {item.storageGB}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-semibold">₦{item.sellingPrice.toLocaleString()}</td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          inCollection
                            ? 'bg-amber-500/10 text-amber-700'
                            : item.isAvailable
                            ? 'bg-green-500/10 text-green-700'
                            : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {inCollection ? 'In Collection' : item.isAvailable ? 'Available' : 'Sold'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEdit(item)}
                            title="Edit product"
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDelete(item.id)}
                            title="Delete product"
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{items.length}</span> of{' '}
            <span className="font-semibold text-foreground">{total}</span> products
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => onPageChange(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      n === page
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      {!showPagination && (
        <p className="text-sm text-muted-foreground">
          Showing {items.length} {items.length === 1 ? 'product' : 'products'}
        </p>
      )}
    </>
  );
}
