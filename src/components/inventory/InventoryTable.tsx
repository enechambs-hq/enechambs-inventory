import { Pencil, Trash2 } from 'lucide-react';
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

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Product', 'IMEI', 'Company', 'Color', 'Storage', 'Selling Price', 'Status', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center">
                  <div className="flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-muted-foreground">
                  No products found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.imei || '—'}</td>
                  <td className="px-4 py-3">{item.companyName || '—'}</td>
                  <td className="px-4 py-3">{item.color}</td>
                  <td className="px-4 py-3">{item.storageGB}</td>
                  <td className="px-4 py-3">₦{item.sellingPrice.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      collectionSerials.has(item.imei)
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : item.isAvailable
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {collectionSerials.has(item.imei) ? 'In Collection' : item.isAvailable ? 'Available' : 'Sold'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(item)} title="Edit product" className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onDelete(item.id)} title="Delete product" className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total} products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <span className="text-sm">{page} / {totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) : !showPagination ? (
        <p className="text-sm text-muted-foreground">
          Showing {items.length} {items.length === 1 ? 'product' : 'products'}
        </p>
      ) : null}
    </>
  );
}
