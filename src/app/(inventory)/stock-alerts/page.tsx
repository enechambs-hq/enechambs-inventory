'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService } from '@/lib/services/inventory.service';
import { stockAlertsService } from '@/lib/services/stockAlerts.service';
import { InventoryItem } from '@/types';
import SkeletonRow from '@/components/shared/SkeletonRow';
import EmptyState from '@/components/stock-alerts/EmptyState';
import RestockDialog from '@/components/stock-alerts/RestockDialog';

const SKELETON_WIDTHS = [220, 140, 90, 90, 60, 160, 90];

function QtyPill({ qty, min, unit }: { qty: number; min: number; unit: string }) {
  const critical = qty / min <= 0.4;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
      style={{
        color: critical ? '#9b1d10' : '#8a5a0a',
        background: critical ? '#fef0ee' : '#fff5e0',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: critical ? '#d8412f' : '#e09515' }}
      />
      {qty} {unit}
    </span>
  );
}

export default function StockAlertsPage() {
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await inventoryService.getLowStockAlerts();
      setAlerts(data);
    } catch {
      toast.error('Failed to load stock alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRestock = async (newQty: number) => {
    if (!restockItem) return;
    setIsRestocking(true);
    try {
      await inventoryService.update(restockItem.id, { quantity: newQty });
      await stockAlertsService.resolve(restockItem.id);
      toast.success(`${restockItem.productName} restocked`);
      setRestockItem(null);
      await fetchAlerts();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message ||
        'Failed to restock item';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsRestocking(false);
    }
  };

  const TABLE_HEADERS = [
    { label: 'Product Name', align: 'left' },
    { label: 'Category', align: 'left' },
    { label: 'Current Qty', align: 'left' },
    { label: 'Min Threshold', align: 'right' },
    { label: 'Unit', align: 'left' },
    { label: 'Supplier', align: 'left' },
    { label: 'Action', align: 'right' },
  ];

  return (
    <>
      <div className="min-h-screen bg-[#f0f2f0] p-6">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Stock Alerts</h1>
              {!isLoading && alerts.length > 0 && (
                <span className="text-xs font-semibold text-[#155f3a] bg-[#e8f5ee] px-2.5 py-1 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Products running low on stock — restock these to keep your shelves full.
            </p>
          </div>
        </div>

        {/* Alert Banner */}
        {!isLoading && alerts.length > 0 && !bannerDismissed && (
          <div
            className="flex items-start gap-3 p-3.5 rounded-xl mb-5 border"
            style={{ background: '#fff8eb', borderColor: '#fbe2a8' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#fde7b3', color: '#8a5a0a' }}
            >
              <AlertTriangle size={16} strokeWidth={1.8} />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-semibold" style={{ color: '#5e3f00' }}>
                {alerts.length} product{alerts.length !== 1 ? 's are' : ' is'} running low on stock
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#8a6920' }}>
                Items below their minimum threshold need restocking. Tap &ldquo;Restock&rdquo; once
                you&rsquo;ve replenished a product.
              </p>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: '#8a6920' }}
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && alerts.length === 0 && <EmptyState />}

        {/* Table */}
        {(isLoading || alerts.length > 0) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {TABLE_HEADERS.map((h) => (
                      <th
                        key={h.label}
                        className={`px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide ${
                          h.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonRow key={i} widths={SKELETON_WIDTHS} />
                      ))
                    : alerts.map((item, i) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50/60 transition-colors ${
                            i < alerts.length - 1 ? 'border-b border-gray-50' : ''
                          }`}
                        >
                          {/* Product Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
                                <Package size={17} className="text-[#1a7a4a]" strokeWidth={1.7} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {item.productName}
                                </p>
                                {item.serialNumber && (
                                  <p className="text-xs text-gray-400 mt-0.5">{item.serialNumber}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {item.category?.name ?? <span className="text-gray-300 italic">—</span>}
                          </td>

                          {/* Current Qty */}
                          <td className="px-6 py-4">
                            <QtyPill qty={item.quantity} min={item.restockThreshold} unit={item.unit} />
                          </td>

                          {/* Min Threshold */}
                          <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-500">
                            {item.restockThreshold} {item.unit}s
                          </td>

                          {/* Unit */}
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                            {item.unit}
                          </td>

                          {/* Supplier */}
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-40 truncate pr-4">
                            {item.supplierRef ?? <span className="text-gray-300 italic">—</span>}
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4">
                            <div className="flex justify-end">
                              <button
                                onClick={() => setRestockItem(item)}
                                className="h-8 px-3 rounded-lg bg-[#1a7a4a] text-white text-xs font-semibold hover:bg-[#145c37] transition-colors inline-flex items-center gap-1 shadow-sm"
                              >
                                Restock
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {!isLoading && alerts.length > 0 && (
              <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/40">
                <p className="text-xs text-gray-400">
                  Showing{' '}
                  <span className="font-medium text-gray-600">{alerts.length}</span> low-stock{' '}
                  {alerts.length === 1 ? 'product' : 'products'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {restockItem && (
        <RestockDialog
          item={restockItem}
          onClose={() => setRestockItem(null)}
          onConfirm={handleRestock}
          isLoading={isRestocking}
        />
      )}
    </>
  );
}
