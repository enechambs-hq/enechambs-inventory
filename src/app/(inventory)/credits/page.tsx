'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { creditsService } from '@/lib/services/credits.service';
import { dashboardService } from '@/lib/services/dashboard.service';
import { Credit, CreateCreditDto, CreditStats, CreditStatus } from '@/types';
import CreditForm from '@/components/shared/CreditForm';
import CreditsCards from '@/components/dashboard/CreditsCards';

const STATUS_STYLES: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: 'bg-yellow-50 text-yellow-700',
  [CreditStatus.PARTIAL]: 'bg-blue-50 text-blue-700',
  [CreditStatus.PAID]: 'bg-green-50 text-green-700',
  [CreditStatus.OVERDUE]: 'bg-orange-50 text-orange-700',
  [CreditStatus.DEFAULTED]: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: 'Pending',
  [CreditStatus.PARTIAL]: 'Partial',
  [CreditStatus.PAID]: 'Paid',
  [CreditStatus.OVERDUE]: 'Overdue',
  [CreditStatus.DEFAULTED]: 'Defaulted',
};

const STATUS_PILL_COLORS: Record<CreditStatus, string> = {
  [CreditStatus.PENDING]: 'bg-yellow-500/10 text-yellow-600',
  [CreditStatus.PARTIAL]: 'bg-blue-500/10 text-blue-600',
  [CreditStatus.PAID]: 'bg-green-500/10 text-green-600',
  [CreditStatus.OVERDUE]: 'bg-orange-500/10 text-orange-600',
  [CreditStatus.DEFAULTED]: 'bg-red-500/10 text-red-600',
};

type ActiveTab = 'all' | 'mine' | 'overdue';
type StatusFilter = CreditStatus | '';

function CreditDetailModal({ credit, onClose, onPaymentRecorded }: { credit: Credit; onClose: () => void; onPaymentRecorded: (updated: Credit) => void }) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentCredit, setCurrentCredit] = useState(credit);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const canPay = !['paid', 'defaulted'].includes(currentCredit.status);
  const requiresVoidReason = (s: string) => s === 'defaulted';

  const handleStatusChange = async (status: string) => {
    if (requiresVoidReason(status)) {
      setPendingStatus(status);
      return;
    }
    await submitStatusChange(status);
  };

  const submitStatusChange = async (status: string, reason?: string) => {
    try {
      setUpdatingStatus(true);
      const updated = await creditsService.updateStatus(currentCredit.id, status, reason);
      setCurrentCredit(updated);
      toast.success(`Status updated to ${status}`);
      onPaymentRecorded(updated);
      setPendingStatus(null);
      setVoidReason('');
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
          <p className="text-sm text-muted-foreground">{currentCredit.color} · {currentCredit.storageGB} · IMEI: {currentCredit.imei}</p>
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

        {/* Void reason prompt */}
        {pendingStatus && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4 space-y-3">
            <p className="text-xs font-medium text-destructive uppercase tracking-wide">
              Mark as {pendingStatus} — provide reason
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for marking as defaulted…"
              rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setPendingStatus(null); setVoidReason(''); }}
                className="flex-1 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submitStatusChange(pendingStatus, voidReason || undefined)}
                disabled={updatingStatus}
                className="flex-1 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {updatingStatus ? 'Updating…' : 'Confirm'}
              </button>
            </div>
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creditStats, setCreditStats] = useState<CreditStats | null>(null);

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
        const filters = {
          page,
          limit,
          ...(search ? { productName: search, customerName: search, customerPhone: search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        };
        const data = activeTab === 'all'
          ? await creditsService.getAll(filters)
          : await creditsService.getMyCredits(filters);
        setCredits(data.data);
        setTotal(data.meta.total);
        setTotalPages(data.meta.totalPages);
      }
    } catch {
      toast.error('Failed to load credits');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, search, statusFilter, limit]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    dashboardService.getCreditStats().then(setCreditStats).catch(() => {});
  }, []);

  const creditsForCards = creditStats
    ? {
        total: creditStats.totalCredits,
        paid: creditStats.byStatus[CreditStatus.PAID] ?? 0,
        outstanding: creditStats.outstandingBalance,
        overdue: creditStats.byStatus[CreditStatus.OVERDUE] ?? 0,
      }
    : null;

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

      {creditsForCards && <CreditsCards credits={creditsForCards} />}

      {creditStats && (
        <>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">By Status</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(creditStats.byStatus) as [CreditStatus, number][]).map(([status, count]) => (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_PILL_COLORS[status]}`}
                >
                  {STATUS_LABELS[status]}
                  <span className="font-bold">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {creditStats.overdueCredits.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Overdue</p>
              <div className="space-y-2">
                {creditStats.overdueCredits.map((credit) => (
                  <div
                    key={credit.id}
                    className="flex items-center justify-between rounded-xl border border-orange-200/60 bg-orange-50/40 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{credit.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {credit.productName} · Due {format(new Date(credit.dueDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-orange-600">
                        ₦{Number(credit.remainingBalance).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">remaining</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <hr className="border-border my-6" />

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

      {/* Search + Status filter */}
      {activeTab !== 'overdue' && (
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by customer, phone or product…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {(Object.values(CreditStatus) as CreditStatus[]).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
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
