'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useIncomingOrdersStore } from '@/store/incomingOrders.store';
import { incomingOrdersService } from '@/lib/services/incomingOrders.service';
import { IncomingOrderStatus, UserRole, CreateIncomingOrderDto } from '@/types';
import { formatAmount } from '@/lib/utils';
import IncomingOrderForm from '@/components/shared/IncomingOrderForm';

type ActiveTab = 'all' | 'mine';

const STATUS_STYLES: Record<IncomingOrderStatus, string> = {
  [IncomingOrderStatus.PENDING]:   'bg-yellow-500/10 text-yellow-700',
  [IncomingOrderStatus.CONVERTED]: 'bg-green-500/10 text-green-700',
  [IncomingOrderStatus.CANCELLED]: 'bg-red-500/10 text-red-600',
};

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
    if (activeTab === 'all') fetchAll();
    else fetchMine();
  }, [activeTab, fetchAll, fetchMine]);

  const handleCreate = async (data: CreateIncomingOrderDto) => {
    try {
      setSubmitting(true);
      await incomingOrdersService.create(data);
      toast.success('Inquiry recorded successfully');
      setModalOpen(false);
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
      if (activeTab === 'all') fetchAll();
      else fetchMine();
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message || 'Failed to update status';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setUpdatingId(null);
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
              {['Date', 'Expiry', 'Product', 'Customer', 'Phone', 'Expected (₦)', 'Status', 'By', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                </td>
              </tr>
            ) : displayedOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
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

      {/* Modal */}
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
    </div>
  );
}
