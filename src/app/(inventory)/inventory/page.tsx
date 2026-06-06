"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Package, ShoppingCart, Wallet, Coins } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useInventoryStore } from "@/store/inventory.store";
import { inventoryService } from "@/lib/services/inventory.service";
import { categoriesService } from "@/lib/services/categories.service";
import { dashboardService } from "@/lib/services/dashboard.service";
import { InventoryItem, CreateInventoryDto, UserRole, Category, DailySummary, StockValueResponse } from "@/types";
import InventoryForm from "@/components/shared/InventoryForm";
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
    outOfStock: number;
  } | null>(null);
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockValue, setStockValue] = useState<StockValueResponse | null>(null);
  const [filterSnapshot, setFilterSnapshot] = useState<InventoryItem[] | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [filterPage, setFilterPage] = useState(1);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getAll({ page, limit, productName: search });
      setItems(data.data, data.meta);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, setItems, setLoading]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    const refresh = () => {
      inventoryService.getStockLevels().then(setStockLevels).catch(() => {});
      inventoryService.getLowStockAlerts().then(setLowStock).catch(() => {});
      inventoryService.getStockValue().then(setStockValue).catch(() => {});
      categoriesService.getAll().then(setCategories).catch(() => {});
      dashboardService.getDaily().then(setDaily).catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeFilter === "all") {
      setFilterSnapshot(null);
      return;
    }
    setIsFilterLoading(true);
    setFilterPage(1);
    inventoryService
      .getAll({ limit: stockLevels?.total ?? 500, productName: search })
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
      dashboardService.getDaily().then(setDaily).catch(() => {});
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
      dashboardService.getDaily().then(setDaily).catch(() => {});
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

  const isFiltered = activeFilter !== "all";
  const filterTotalPages = Math.max(1, Math.ceil(filteredItems.length / limit));
  const displayItems = isFiltered
    ? filteredItems.slice((filterPage - 1) * limit, filterPage * limit)
    : filteredItems;

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
            style={{ boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }}
          >
            <Plus size={16} />
            Add Product
          </button>
        )}
      </div>

      {stockLevels && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Package size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available Now</p>
              <p className="text-2xl font-bold text-green-600">{stockLevels.available}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <ShoppingCart size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sold Today</p>
              <p className="text-2xl font-bold text-red-500">{daily?.sales.count ?? 0}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Value</p>
              <p className="text-2xl font-bold text-foreground">
                {stockValue && !isNaN(stockValue.totalValue)
                  ? '₦' + Math.round(stockValue.totalValue).toLocaleString('en-NG')
                  : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Based on selling price</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Coins size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Value</p>
              <p className="text-2xl font-bold text-foreground">
                {stockValue && !isNaN(stockValue.totalCostValue)
                  ? '₦' + Math.round(stockValue.totalCostValue).toLocaleString('en-NG')
                  : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Items with cost price only</p>
            </div>
          </div>
        </div>
      )}
      {user?.role === UserRole.ADMIN && <LowStockAlert items={lowStock} />}

      <InventoryFilters
        activeFilter={activeFilter}
        searchQuery={search}
        onFilterChange={(f) => {
          setActiveFilter(f);
          setPage(1);
          setFilterPage(1);
        }}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
      />

      <InventoryTable
        items={displayItems}
        categories={categories}
        isLoading={isLoading || isFilterLoading}
        userRole={user?.role}
        page={isFiltered ? filterPage : page}
        totalPages={isFiltered ? filterTotalPages : totalPages}
        total={isFiltered ? filteredItems.length : total}
        showPagination
        onEdit={(item) => {
          setEditItem(item);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
        onPageChange={isFiltered ? setFilterPage : setPage}
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
