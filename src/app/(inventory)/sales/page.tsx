'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Search, Receipt, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useSalesStore } from '@/store/sales.store';
import { salesService } from '@/lib/services/sales.service';
import { CreateSaleDto } from '@/types';
import SaleForm from '@/components/shared/SaleForm';

type ActiveTab = 'all' | 'mine';

export default function SalesPage() {
  const { sales, mySales, total, page, limit, totalPages, isLoading, setSales, setMySales, setLoading, setPage } =
    useSalesStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Animated placeholder
  const PLACEHOLDERS = ['phone...', 'name...', 'product name...'];
  const [phIndex, setPhIndex] = useState(0);
  const [phVisible, setPhVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setPhVisible(false);
      setTimeout(() => {
        setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
        setPhVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [submitting, setSubmitting] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await salesService.getAll({
        page,
        limit,
        productName: searchQuery,
        customerName: searchQuery,
        customerPhone: searchQuery,
      });
      setSales(data.data, data.meta);
    } catch {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, setLoading, setSales]);

  const fetchMySales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await salesService.getMySales({ page, limit });
      setMySales(data.data, data.meta);
    } catch {
      toast.error('Failed to load your sales');
    } finally {
      setLoading(false);
    }
  }, [page, limit, setLoading, setMySales]);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchSales();
    } else {
      fetchMySales();
    }
  }, [activeTab, fetchSales, fetchMySales]);

  const handleSubmit = async (data: CreateSaleDto) => {
    try {
      setSubmitting(true);
      await salesService.create(data);
      toast.success('Sale recorded successfully');
      setModalOpen(false);
      fetchSales();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = async (id: string) => {
    try {
      const html = await salesService.getReceipt(id);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to load receipt');
    }
  };

  const displayedSales = activeTab === 'all' ? sales : mySales;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">Track all sales records</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Record Sale
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['all', 'mine'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All Sales' : 'My Sales'}
          </button>
        ))}
      </div>

      {/* Search — all tab only */}
      {activeTab === 'all' && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          {!searchQuery && (
            <span className="absolute left-8 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none flex items-center gap-1">
              Search by{" "}
              <span
                className={`transition-opacity duration-300 ${phVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                {PLACEHOLDERS[phIndex]}
              </span>
            </span>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-transparent"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Date', 'Product', 'IMEI', 'Customer', 'Phone', 'Amount', 'Condition', 'Account', 'Receipt'].map(
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
                <td colSpan={9} className="px-4 py-8 text-center">
                  <div className="flex justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
                </td>
              </tr>
            ) : displayedSales.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  {activeTab === 'mine' ? (
                    <div>
                      <ShoppingCart size={32} className="text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground text-center">You have no recorded sales yet</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No sales found</span>
                  )}
                </td>
              </tr>
            ) : (
              displayedSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(sale.date), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 font-medium">{sale.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sale.imei || '—'}</td>
                  <td className="px-4 py-3">{sale.customerName}</td>
                  <td className="px-4 py-3">{sale.customerPhone}</td>
                  <td className="px-4 py-3">₦{sale.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{sale.condition}</td>
                  <td className="px-4 py-3">{sale.accountPaidTo}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewReceipt(sale.id)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Receipt size={12} />
                      View
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
          <p className="text-sm text-muted-foreground">
            Showing {displayedSales.length} of {total} sales
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <span className="text-sm">{page} / {totalPages}</span>
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
          <div className="relative bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {submitting && (
              <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium">Recording sale...</span>
                </div>
              </div>
            )}
            <h2 className="text-lg font-semibold mb-4">Record New Sale</h2>
            <SaleForm
              onSubmit={handleSubmit}
              isLoading={submitting}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}