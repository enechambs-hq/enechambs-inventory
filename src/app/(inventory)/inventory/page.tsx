"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useInventoryStore } from "@/store/inventory.store";
import { inventoryService } from "@/lib/services/inventory.service";
import { categoriesService } from "@/lib/services/categories.service";
import { InventoryItem, CreateInventoryDto, UserRole, Category } from "@/types";
import InventoryForm from "@/components/shared/InventoryForm";
import StockLevelCards from "@/components/inventory/StockLevelCards";
import LowStockAlert from "@/components/inventory/LowStockAlert";
import InventoryFilters from "@/components/inventory/InventoryFilters";
import InventoryTable from "@/components/inventory/InventoryTable";

type ActiveFilter = "all" | "available" | "sold";

export default function InventoryPage() {
  const { user } = useAuthStore();
  const {
    items,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    setItems,
    setLoading,
    setPage,
  } = useInventoryStore();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockLevels, setStockLevels] = useState<{
    total: number;
    available: number;
    sold: number;
  } | null>(null);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterSnapshot, setFilterSnapshot] = useState<InventoryItem[] | null>(
    null,
  );
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getAll({ page, limit, productName: search });
      setItems(data.data, data.meta);
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setItems, setLoading]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    inventoryService.getStockLevels().then(setStockLevels).catch(() => {});
    inventoryService.getLowStockAlerts().then(setLowStock).catch(() => {});
    categoriesService.getAll().then(setCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeFilter === "all") {
      setFilterSnapshot(null);
      return;
    }
    setIsFilterLoading(true);
    inventoryService
      .getAll({ limit: 100, productName: search })
      .then((data) => setFilterSnapshot(data.data))
      .catch(() => setFilterSnapshot([]))
      .finally(() => setIsFilterLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, search]);

  const handleSubmit = async (data: CreateInventoryDto) => {
    try {
      setSubmitting(true);
      if (editItem) {
        const { dateAdded: _d, ...updateData } = data;
        void _d;
        await inventoryService.update(editItem.id, updateData);
        toast.success("Product updated successfully");
      } else {
        await inventoryService.create(data);
        toast.success("Product added successfully");
      }
      setModalOpen(false);
      setEditItem(null);
      await fetchInventory();
      inventoryService.getStockLevels().then(setStockLevels).catch(() => {});
    } catch (error) {
      const err = error as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      if (err.response?.status === 500) {
        toast.error("Failed to save product. Please try again.");
      } else {
        const msg = err.response?.data?.message || "Something went wrong";
        toast.error(Array.isArray(msg) ? msg[0] : msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await inventoryService.delete(id);
      toast.success("Product deleted");
      await fetchInventory();
      inventoryService.getStockLevels().then(setStockLevels).catch(() => {});
    } catch {
      toast.error("Failed to delete product");
    }
  };

  const baseItems = filterSnapshot !== null ? filterSnapshot : items;
  const filteredItems = baseItems.filter((item) => {
    if (activeFilter === "available") return item.isAvailable;
    if (activeFilter === "sold") return !item.isAvailable;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product stock</p>
        </div>
        {user?.role === UserRole.ADMIN && (
          <button
            onClick={() => {
              setEditItem(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            style={{ boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
          >
            <Plus size={16} />
            Add Product
          </button>
        )}
      </div>

      {stockLevels && <StockLevelCards stockLevels={stockLevels} />}
      {user?.role === UserRole.ADMIN && <LowStockAlert items={lowStock} />}

      <InventoryFilters
        activeFilter={activeFilter}
        searchQuery={search}
        onFilterChange={(f) => {
          setActiveFilter(f);
          setPage(1);
        }}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
      />

      <InventoryTable
        items={filteredItems}
        categories={categories}
        isLoading={isLoading || isFilterLoading}
        userRole={user?.role}
        page={page}
        totalPages={totalPages}
        total={total}
        showPagination={activeFilter === "all"}
        onEdit={(item) => {
          setEditItem(item);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
        onPageChange={setPage}
      />

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="relative bg-card rounded-2xl border border-border p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            {submitting && (
              <div className="absolute inset-0 bg-card/85 rounded-2xl flex items-center justify-center z-10 gap-3">
                <div className="h-5 w-5 rounded-full border-[2.5px] border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-semibold">Saving…</span>
              </div>
            )}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-[17px] font-bold">
                  {editItem ? 'Edit Product' : 'Add Product'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {editItem ? 'Update product details below' : 'Fill in the details to add a new product'}
                </p>
              </div>
              <button
                onClick={() => { setModalOpen(false); setEditItem(null); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus size={18} className="rotate-45" />
              </button>
            </div>
            <InventoryForm
              defaultValues={editItem || undefined}
              onSubmit={handleSubmit}
              isLoading={submitting}
              onCancel={() => {
                setModalOpen(false);
                setEditItem(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
