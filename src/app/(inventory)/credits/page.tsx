'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { creditsService } from '@/lib/services/credits.service';
import { Credit, CreateCreditDto, CreditStatus } from '@/types';
import CreditForm from '@/components/shared/CreditForm';

const STATUS_STYLES: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: 'bg-yellow-50 text-yellow-700',
  [CreditStatus.PARTIAL]: 'bg-blue-50 text-blue-700',
  [CreditStatus.PAID]: 'bg-green-50 text-green-700',
  [CreditStatus.OVERDUE]: 'bg-orange-50 text-orange-700',
  [CreditStatus.DEFAULTED]: 'bg-red-50 text-red-700',
};

type ActiveTab = 'all' | 'mine' | 'overdue';

function CreditDetailModal({ credit, onClose, onPaymentRecorded }: { credit: Credit; onClose: () => void; onPaymentRecorded: (updated: Credit) => void }) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentCredit, setCurrentCredit] = useState(credit);

  const canPay = !['paid', 'defaulted'].includes(currentCredit.status);

  const handleStatusChange = async (status: string) => {
    try {
      setUpdatingStatus(true);
      const updated = await creditsService.updateStatus(currentCredit.id, status);
      setCurrentCredit(updated);
      toast.success(`Status updated to ${status}`);
      onPaymentRecorded(updated);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePayment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;
    try {
      setSubmitting(true);
      const updated = await creditsService.recordPayment(currentCredit.id, amount, paymentNote || undefined);
      setCurrentCredit(updated);
      setPaymentAmount('');
      setPaymentNote('');
      toast.success('Payment recorded');
      onPaymentRecorded(updated);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message || 'Failed to record payment';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Credit Details</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[currentCredit.status]}`}>
            {currentCredit.status}
          </span>
          <select
            value={currentCredit.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            className="text-xs px-2 py-1 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {(['pending', 'partial', 'paid', 'overdue', 'defaulted'] as CreditStatus[]).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {updatingStatus && <span className="text-xs text-muted-foreground">Updating...</span>}
        </div>

        {/* Product */}
        <div className="rounded-lg border bg-muted/30 p-4 mb-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Product</p>
          <p className="font-semibold">{currentCredit.productName}</p>
          <p className="text-sm text-muted-foreground">{currentCredit.color} · {currentCredit.storageGB}GB · IMEI: {currentCredit.imei}</p>
        </div>

        {/* Customer */}
        <div className="rounded-lg border bg-muted/30 p-4 mb-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer</p>
          <p className="font-semibold">{currentCredit.customerName}</p>
          <p className="text-sm text-muted-foreground">{currentCredit.customerPhone}</p>
          {currentCredit.customerEmail && <p className="text-sm text-muted-foreground">{currentCredit.customerEmail}</p>}
        </div>

        {/* Financials */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Amount', value: `₦${Number(currentCredit.amount).toLocaleString()}` },
            { label: 'Paid', value: `₦${Number(currentCredit.amountPaid).toLocaleString()}` },
            { label: 'Balance', value: `₦${Number(currentCredit.remainingBalance).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-bold mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Sale Date', value: format(new Date(currentCredit.date), 'MMM d, yyyy') },
            { label: 'Due Date', value: format(new Date(currentCredit.dueDate), 'MMM d, yyyy') },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Record Payment */}
        {canPay && (
          <div className="rounded-lg border p-4 mb-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Record Payment</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Amount (₦)"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min={1}
                className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handlePayment}
              disabled={submitting || !paymentAmount}
              className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        )}

        {/* Payment history */}
        {currentCredit.paymentHistory.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Payment History</p>
            <div className="space-y-2">
              {currentCredit.paymentHistory.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">₦{Number(p.amount).toLocaleString()}</p>
                    {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(p.date), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [credits, setCredits] = useState<Credit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const limit = 20;

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'overdue') {
        const data = await creditsService.getOverdue();
        setCredits(data);
        setTotal(data.length);
        setTotalPages(1);
      } else {
        const data = activeTab === 'all'
          ? await creditsService.getAll(page, limit, search)
          : await creditsService.getMyCredits(page, limit);
        setCredits(data.data);
        setTotal(data.meta.total);
        setTotalPages(data.meta.totalPages);
      }
    } catch {
      toast.error('Failed to load credits');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, search, limit]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const handleRowClick = async (id: string) => {
    try {
      setLoadingDetail(true);
      const data = await creditsService.getById(id);
      setSelectedCredit(data);
    } catch {
      toast.error('Failed to load credit details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (data: CreateCreditDto) => {
    try {
      setSubmitting(true);
      await creditsService.create(data);
      toast.success('Credit recorded successfully');
      setModalOpen(false);
      fetchCredits();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message || 'Failed to record credit';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
          <p className="text-sm text-muted-foreground">
            {total} credit{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New Credit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([['all', 'All Credits'], ['mine', 'My Credits'], ['overdue', 'Overdue']] as [ActiveTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? tab === 'overdue' ? 'border-orange-500 text-orange-600' : 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'all' && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer or product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {['Date', 'Product', 'Customer', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</td>
                </tr>
              ) : credits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No credits found</td>
                </tr>
              ) : (
                credits.map((credit) => (
                  <tr
                    key={credit.id}
                    onClick={() => handleRowClick(credit.id)}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${loadingDetail ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(credit.date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 font-medium">{credit.productName}</td>
                    <td className="px-4 py-3">
                      <p>{credit.customerName}</p>
                      <p className="text-xs text-muted-foreground">{credit.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3">₦{Number(credit.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">₦{Number(credit.amountPaid).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">₦{Number(credit.remainingBalance).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(credit.dueDate), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[credit.status]}`}>
                        {credit.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <p className="text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors">Previous</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-md border text-sm disabled:opacity-50 hover:bg-muted transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* New Credit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 h-screen bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300">
            <h2 className="text-lg font-semibold mb-1">New Credit Sale</h2>
            <p className="text-sm text-muted-foreground mb-5">Record an item sold on credit.</p>
            <CreditForm onSubmit={handleSubmit} isLoading={submitting} onCancel={() => setModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCredit && (
        <CreditDetailModal
          credit={selectedCredit}
          onClose={() => setSelectedCredit(null)}
          onPaymentRecorded={(updated) => {
            setCredits((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setSelectedCredit(updated);
          }}
        />
      )}
    </div>
  );
}
