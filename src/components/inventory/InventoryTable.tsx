import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Category, InventoryItem, UserRole } from '@/types';
import { formatUnit } from '@/lib/formatUnit';

interface Props {
  items: InventoryItem[];
  categories: Category[];
  isLoading: boolean;
  userRole?: UserRole;
  page: number;
  totalPages: number;
  total: number;
  showPagination: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
}

const HEADERS_BASE = ['Product', 'Qty', 'Category', 'Cost Price', 'Selling Price', 'Status'];

export default function InventoryTable({
  items,
  categories,
  isLoading,
  userRole,
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
                  const isLowStock = item.quantity <= item.restockThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                      {/* Product */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[13.5px]">{item.productName}</span>
                          {item.variant && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/10 text-green-700 border border-green-500/20 whitespace-nowrap">
                              {item.variant}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Qty + unit + low stock badge */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span>{formatUnit(item.quantity, item.unit)}</span>
                          {isLowStock && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 whitespace-nowrap">
                              Low stock
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-3 text-muted-foreground">
                        {item.category?.name ?? categories.find((c) => c.id === item.categoryId)?.name ?? '—'}
                      </td>

                      {/* Cost Price */}
                      <td className="px-3.5 py-3 text-muted-foreground">₦{item.costPrice.toLocaleString()}</td>

                      {/* Selling Price */}
                      <td className="px-3.5 py-3 font-semibold">₦{item.sellingPrice.toLocaleString()}</td>

                      {/* Status */}
                      <td className="px-3.5 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.isAvailable
                              ? 'bg-green-500/10 text-green-700'
                              : 'bg-red-500/10 text-red-600'
                          }`}
                        >
                          {item.isAvailable ? 'Available' : 'Out of Stock'}
                        </span>
                      </td>

                      {/* Actions */}
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
