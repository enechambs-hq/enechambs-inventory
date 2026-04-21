'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Search, ClipboardList, Layers, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useIncomingOrdersStore } from '@/store/incomingOrders.store';
import { incomingOrdersService } from '@/lib/services/incomingOrders.service';
import { IncomingOrderStatus, IncomingOrderStats, InventoryItem, UserRole, CreateIncomingOrderDto } from '@/types';
import { formatAmount } from '@/lib/utils';
import IncomingOrderForm from '@/components/shared/IncomingOrderForm';

type ActiveTab = 'all' | 'mine';

const STATUS_STYLES: Record<IncomingOrderStatus, string> = {
  [IncomingOrderStatus.PENDING]:   'bg-yellow-500/10 text-yellow-700',
  [IncomingOrderStatus.CONVERTED]: 'bg-green-500/10 text-green-700',
  [IncomingOrderStatus.CANCELLED]: 'bg-red-500/10 text-red-600',
};

const STAT_CARDS = [
  { label: 'Total',     key: 'total',     color: 'text-foreground',    bg: 'bg-muted/50' },
  { label: 'Pending',   key: IncomingOrderStatus.PENDING,   color: 'text-yellow-700', bg: 'bg-yellow-500/10' },
  { label: 'Converted', key: IncomingOrderStatus.CONVERTED, color: 'text-green-700',  bg: 'bg-green-500/10'  },
  { label: 'Cancelled', key: IncomingOrderStatus.CANCELLED, color: 'text-red-600',    bg: 'bg-red-500/10'    },
] as const;

export default function IncomingOrdersPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === UserRole.ADMIN;

  const { orders, myOrders, total, page, limit, totalPages, isLoading, setOrders, setMyOrders, setLoading, setPage } =
    useIncomingOrdersStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>(isAdmin ? 'all' : 'mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncomingOrderStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<IncomingOrderStats | null>(null);

  // Similar items modal
  const [similarModal, setSimilarModal] = useState<{
    open: boolean;
    orderId: string;
    productName: string;
    items: InventoryItem[];
    loading: boolean;
  }>({ open: false, orderId: '', productName: '', items: [], loading: false });

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await incomingOrdersService.getStatistics();
      setStats(data);
    } catch {
      // fail silently — stats are supplementary
    }
  }, [isAdmin]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const data = await incomingOrdersService.getAll({
        page, limit,
        productName: searchQuery,
        customerName: searchQuery,
        customerPhone: searchQuery,
        status: statusFilter,
      });
      setOrders(data.data, data.meta);
    } catch {
      toast.error('Failed to load incoming orders');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter, setLoading, setOrders]);

  const fetchMine = useCallback(async () => {
    try {
      setLoading(true);
      const data = await incomingOrdersService.getMyInquiries({ page, limit });
      setMyOrders(data.data, data.meta);
    } catch {
      toast.error('Failed to load your inquiries');
    } finally {
      setLoading(false);
    }
  }, [page, limit, setLoading, setMyOrders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'all') fetchAll();
    else fetchMine();
  }, [activeTab, fetchAll, fetchMine]);

  const handleCreate = async (data: CreateIncomingOrderDto) => {
    try {
      setSubmitting(true);
      await incomingOrdersService.create(data);
      toast.success('Inquiry recorded successfully');
      setModalOpen(false);
      fetchStats();
      if (activeTab === 'all') fetchAll();
      else fetchMine();
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: IncomingOrderStatus) => {
    try {
      setUpdatingId(id);
      await incomingOrdersService.updateStatus(id, status);
      toast.success('Status updated');
      fetchStats();
      if (activeTab === 'all') fetchAll();
      else fetchMine();
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message || 'Failed to update status';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewSimilar = async (orderId: string, productName: string) => {
    setSimilarModal({ open: true, orderId, productName, items: [], loading: true });
    try {
      const items = await incomingOrdersService.getSimilarItems(orderId);
      setSimilarModal((prev) => ({ ...prev, items, loading: false }));
    } catch {
      setSimilarModal((prev) => ({ ...prev, loading: false }));
      toast.error('Failed to load similar items');
    }
  };

  const displayedOrders = activeTab === 'all' ? orders : myOrders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incoming Orders</h1>
          <p className="text-sm text-muted-foreground">Customer inquiries and product requests</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New Inquiry
        </button>
      </div>

      {/* Stats — admin only */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ label, key, color, bg }) => {
            const value = key === 'total' ? stats.total : (stats.byStatus?.[key as IncomingOrderStatus] ?? 0);
            return (
              <div key={label} className={`rounded-xl border bg-card p-4 ${bg}`}>
                <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(isAdmin ? ['all', 'mine'] : ['mine']).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab as ActiveTab); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All Orders' : 'My Inquiries'}
          </button>
        ))}
      </div>

      {/* Filters — all tab only */}
      {activeTab === 'all' && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by product, customer, phone..."
              className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as IncomingOrderStatus | ''); setPage(1); }}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All statuses</option>
            <option value={IncomingOrderStatus.PENDING}>Pending</option>
            <option value={IncomingOrderStatus.CONVERTED}>Converted</option>
            <option value={IncomingOrderStatus.CANCELLED}>Cancelled</option>
          </select>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Date', 'Expiry', 'Product', 'Customer', 'Phone', 'Expected (₦)', 'Status', 'By', 'Update Status', 'Similar'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                </td>
              </tr>
            ) : displayedOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <ClipboardList size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No inquiries found</p>
                </td>
              </tr>
            ) : (
              displayedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(order.date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(order.expiryDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 font-medium">{order.inventory?.productName ?? '—'}</td>
                  <td className="px-4 py-3">{order.customerName}</td>
                  <td className="px-4 py-3">{order.customerPhone}</td>
                  <td className="px-4 py-3">₦{formatAmount(order.expectedAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as IncomingOrderStatus)}
                      className="px-2 py-1 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      <option value={IncomingOrderStatus.PENDING}>Pending</option>
                      <option value={IncomingOrderStatus.CONVERTED}>Converted</option>
                      <option value={IncomingOrderStatus.CANCELLED}>Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewSimilar(order.id, order.inventory?.productName ?? 'this item')}
                      title="View similar available items"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Layers size={13} />
                      Similar
                    </button>
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
          <p className="text-sm text-muted-foreground">Showing {displayedOrders.length} of {total} orders</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors">Previous</button>
            <span className="text-sm">{page} / {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {submitting && (
              <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium">Recording inquiry...</span>
                </div>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-4">New Incoming Order</h2>
            <IncomingOrderForm
              onSubmit={handleCreate}
              isLoading={submitting}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Similar items modal */}
      {similarModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Similar Available Items</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Items matching "{similarModal.productName}"</p>
              </div>
              <button onClick={() => setSimilarModal((p) => ({ ...p, open: false }))} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {similarModal.loading ? (
                <div className="flex justify-center py-10">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : similarModal.items.length === 0 ? (
                <div className="text-center py-10">
                  <Layers size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No similar items available in inventory</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Product', 'Color', 'Storage', 'IMEI', 'Selling Price'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {similarModal.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-medium">{item.productName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.color || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.storageGB || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.imei || '—'}</td>
                        <td className="px-3 py-2">₦{formatAmount(item.sellingPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
