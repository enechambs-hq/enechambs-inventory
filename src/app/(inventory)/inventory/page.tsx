'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useInventoryStore } from '@/store/inventory.store';
import { inventoryService } from '@/lib/services/inventory.service';
import { InventoryItem, CreateInventoryDto, UserRole } from '@/types';
import InventoryForm from '@/components/shared/InventoryForm';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const { items, total, page, limit, totalPages, isLoading, setItems, setLoading, setPage } =
    useInventoryStore();

  const [search, setSearch] = useState({ productName: '', imei: '', companyName: '', color: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockLevels, setStockLevels] = useState<any>(null);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getAll({ page, limit, ...search });
      setItems(data.data, data.meta);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchStockLevels = async () => {
    try {
      const data = await inventoryService.getStockLevels();
      setStockLevels(data.data);
    } catch {}
  };

  const fetchLowStock = async () => {
    if (user?.role !== UserRole.ADMIN) return;
    try {
      const data = await inventoryService.getLowStockAlerts();
      setLowStock(data.data);
    } catch {}
  };

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    fetchStockLevels();
    fetchLowStock();
  }, []);

  const handleSubmit = async (data: CreateInventoryDto) => {
    try {
      setSubmitting(true);
      if (editItem) {
        await inventoryService.update(editItem.id, data);
        toast.success('Product updated successfully');
      } else {
        await inventoryService.create(data);
        toast.success('Product added successfully');
      }
      setModalOpen(false);
      setEditItem(null);
      fetchInventory();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await inventoryService.delete(id);
      toast.success('Product deleted');
      fetchInventory();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditItem(item);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage your product stock</p>
        </div>
        <button
          onClick={() => { setEditItem(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Stock level cards */}
      {stockLevels && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(stockLevels).map(([key, value]) => (
            <div key={key} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-2xl font-bold mt-1">{String(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Low stock alerts — admin only */}
      {user?.role === UserRole.ADMIN && lowStock.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-yellow-500" />
            <p className="text-sm font-medium text-yellow-600">
              {lowStock.length} low stock {lowStock.length === 1 ? 'alert' : 'alerts'}
            </p>
          </div>
          <ul className="space-y-1">
            {lowStock.map((item) => (
              <li key={item.id} className="text-xs text-muted-foreground">
                {item.productName} — {item.companyName} ({item.color})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search filters */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'productName', placeholder: 'Search product...' },
          { key: 'imei', placeholder: 'Search IMEI...' },
          { key: 'companyName', placeholder: 'Search company...' },
          { key: 'color', placeholder: 'Search color...' },
        ].map(({ key, placeholder }) => (
          <div key={key} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder={placeholder}
              value={search[key as keyof typeof search]}
              onChange={(e) => setSearch((prev) => ({ ...prev, [key]: e.target.value }))}
              className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Serial No.', 'Product', 'IMEI', 'Company', 'Color', 'Storage', 'Selling Price', 'Status', 'Actions'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No products found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{item.serialNumber}</td>
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.imei}</td>
                  <td className="px-4 py-3">{item.companyName}</td>
                  <td className="px-4 py-3">{item.color}</td>
                  <td className="px-4 py-3">{item.storageGB}GB</td>
                  <td className="px-4 py-3">₦{item.sellingPrice.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.isAvailable
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {item.isAvailable ? 'Available' : 'Sold'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total} products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editItem ? 'Edit Product' : 'Add Product'}
            </h2>
            <InventoryForm
              defaultValues={editItem || undefined}
              onSubmit={handleSubmit}
              isLoading={submitting}
              onCancel={() => { setModalOpen(false); setEditItem(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}