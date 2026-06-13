'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import {
  Plus, Receipt, ChevronLeft, ChevronRight, X, Search,
  ShoppingCart, Wallet, TrendingUp, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useSalesStore } from '@/store/sales.store';
import { salesService } from '@/lib/services/sales.service';
import { dashboardService, RevenueDataPoint } from '@/lib/services/dashboard.service';
import { SaleTransaction, SaleSubmitPayload, UserRole, MonthlySummary } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import SaleForm from '@/components/shared/SaleForm';
import { StatCard } from '@/components/shared/StatCard';

type ActiveTab = 'all' | 'mine';

/* ── helpers ──────────────────────────────────────── */
function fillGaps(data: RevenueDataPoint[], start: string, end: string): RevenueDataPoint[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const effectiveEnd = end > today ? today : end;
  const map = new Map(data.map((d) => [d.date.slice(0, 10), d]));
  const result: RevenueDataPoint[] = [];
  let cur = parseISO(start);
  const last = parseISO(effectiveEnd);
  while (cur <= last) {
    const key = format(cur, 'yyyy-MM-dd');
    result.push(map.get(key) ?? { date: key, total: '0' });
    cur = addDays(cur, 1);
  }
  return result;
}

/* ── Revenue Chart ────────────────────────────────── */
function RevenueChart({ data, startDate, endDate, profitByDate }: {
  data: RevenueDataPoint[]; startDate: string; endDate: string;
  profitByDate: Map<string, number>;
}) {
  const filled = fillGaps(data, startDate, endDate);
  const chartData = filled.map((d) => {
    const key = d.date.slice(0, 10);
    return {
      date: format(new Date(d.date), 'MMM d'),
      Revenue: Number(d.total),
      Profit: profitByDate.get(key) ?? 0,
    };
  });
  const isEmpty = chartData.every((d) => d.Revenue === 0 && d.Profit === 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold">Sales Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue &amp; Profit — last 14 days</p>
        </div>
        <div className="flex items-center gap-4">
          {[['#1a7a4a', 'Revenue'], ['#34d399', 'Profit']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
      {isEmpty ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="salesRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a7a4a" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#1a7a4a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="salesProfitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56}
              tickFormatter={(v) => v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(20,40,100,0.12)' }}
              formatter={(v, name) => [`₦${Number(v).toLocaleString()}`, name]}
              cursor={{ stroke: '#1a7a4a', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area type="monotone" dataKey="Revenue" stroke="#1a7a4a" strokeWidth={2} fill="url(#salesRevGrad)" dot={false} activeDot={{ r: 5, fill: '#1a7a4a', strokeWidth: 0 }} />
            <Area type="monotone" dataKey="Profit" stroke="#34d399" strokeWidth={2} fill="url(#salesProfitGrad)" dot={false} activeDot={{ r: 5, fill: '#34d399', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ── Transaction Detail Modal ─────────────────────── */
function TransactionModal({ txn, onClose, onReceipt }: {
  txn: SaleTransaction; onClose: () => void; onReceipt: (transactionId: string) => void;
}) {
  const totalProfit = txn.items.reduce((s, i) => s + (i.finalPrice - i.costPrice), 0);
  const totalDiscount = txn.items.reduce((s, i) => s + (i.discountAmount ?? 0), 0);
  const margin = txn.total > 0 ? ((totalProfit / txn.total) * 100).toFixed(1) : '0.0';

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl border border-border p-7 w-full max-w-[520px] shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt size={17} className="text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold">
                Ref #{txn.transactionId.slice(0, 8).toUpperCase()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(txn.date), 'MMM d, yyyy')} · {txn.itemCount} item{txn.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Customer */}
        <div className="bg-background rounded-xl p-4 mb-3 border border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
          <p className="text-[14px] font-semibold">{txn.customerName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{txn.customerPhone}</p>
          {txn.customerEmail && <p className="text-xs text-muted-foreground">{txn.customerEmail}</p>}
        </div>

        {/* Items */}
        <div className="bg-background rounded-xl border border-border mb-3 overflow-hidden">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-2">Items</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border bg-muted/40">
                {['Product', 'Qty', 'Unit Price', 'Total'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {txn.items.map((item) => {
                const itemDiscount = item.discountAmount ?? 0;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 text-[13px] font-medium">{item.productName}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">₦{item.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#1a7a4a]">₦{item.finalPrice.toLocaleString()}</span>
                        {itemDiscount > 0 && (
                          <>
                            <span className="text-[11px] text-muted-foreground line-through">₦{item.listPrice.toLocaleString()}</span>
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-[#e8f5ee] text-[#1a7a4a] border border-[#1a7a4a]/20">
                              −₦{itemDiscount.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financials */}
        <div className={`grid gap-2.5 mb-3 ${totalDiscount > 0 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {[
            { label: 'Total Revenue', value: `₦${txn.total.toLocaleString()}`, cls: 'text-[#1a7a4a]' },
            ...(totalDiscount > 0 ? [{ label: 'Total Discounts', value: `−₦${totalDiscount.toLocaleString()}`, cls: 'text-[#1a7a4a]' }] : []),
            { label: 'Total Profit', value: `₦${totalProfit.toLocaleString()}`, cls: totalProfit >= 0 ? 'text-green-600' : 'text-red-500' },
            { label: 'Margin', value: `${margin}%`, cls: totalProfit >= 0 ? 'text-green-600' : 'text-red-500' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-background rounded-xl p-3 border border-border">
              <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
              <p className={`text-[16px] font-extrabold tracking-tight ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Account */}
        <div className="bg-background rounded-xl p-4 border border-border mb-4">
          <p className="text-[11px] text-muted-foreground mb-0.5">Account Paid To</p>
          <p className="text-[13.5px] font-semibold">{txn.accountPaidTo}</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => onReceipt(txn.transactionId)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Receipt size={14} /> View Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
const PLACEHOLDERS = ['product name...', 'customer name...', 'phone...'];
const CHART_START = format(subDays(new Date(), 13), 'yyyy-MM-dd');
const CHART_END = format(new Date(), 'yyyy-MM-dd');

export default function SalesPage() {
  const {
    sales, mySales, total, page, limit, totalPages,
    isLoading, setSales, setMySales, setLoading, setPage,
  } = useSalesStore();

  const { user } = useAuthStore();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailTxn, setDetailTxn] = useState<SaleTransaction | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [chartData, setChartData] = useState<RevenueDataPoint[]>([]);
  const [profitByDate, setProfitByDate] = useState<Map<string, number>>(new Map());
  const [expandedTxns, setExpandedTxns] = useState<Set<string>>(new Set());

  // Animated placeholder
  const [phIndex, setPhIndex] = useState(0);
  const [phVisible, setPhVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setPhVisible(false);
      setTimeout(() => { setPhIndex((i) => (i + 1) % PLACEHOLDERS.length); setPhVisible(true); }, 300);
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats + chart (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    dashboardService.getMonthly().then(setMonthly).catch(() => {});
    dashboardService.getRevenueChart(CHART_START, CHART_END).then(setChartData).catch(() => {});
    salesService.getAll({ limit: 500 }).then((data) => {
      const map = new Map<string, number>();
      data.data.forEach((txn) => {
        const key = txn.date?.slice(0, 10) ?? txn.createdAt?.slice(0, 10);
        if (!key) return;
        const profit = txn.items.reduce((s, i) => s + (i.amount - i.costPrice), 0);
        map.set(key, (map.get(key) ?? 0) + profit);
      });
      setProfitByDate(map);
    }).catch(() => {});
  }, [isAdmin]);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const isPhone = /^\d+$/.test(searchQuery.trim());
      const data = await salesService.getAll({
        page, limit,
        ...(isPhone
          ? { customerPhone: searchQuery }
          : { productName: searchQuery, customerName: searchQuery }),
      });
      setSales(data.data, data.meta);
    } catch {
      // fail silently
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
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [page, limit, setLoading, setMySales]);

  useEffect(() => {
    if (activeTab === 'all') fetchSales();
    else fetchMySales();
  }, [activeTab, fetchSales, fetchMySales]);

  const handleSubmit = async (payload: SaleSubmitPayload) => {
    try {
      setSubmitting(true);
      if (payload.type === 'single') {
        await salesService.create(payload.data);
      } else {
        await salesService.bulkCreate(payload.data);
      }
      toast.success('Sale recorded successfully');
      setModalOpen(false);
      fetchSales();
      dashboardService.getMonthly().then(setMonthly).catch(() => {});
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { message?: string | string[] } } };
      if (err.response?.status === 403) {
        toast.error('Discounts above 5% require an admin.');
        return;
      }
      const message = err.response?.data?.message || 'Something went wrong';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = async (transactionId: string) => {
    try {
      const html = await salesService.getReceipt(transactionId);
      const blob = new Blob([html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      // fail silently
    }
  };

  const toggleExpand = (txnId: string) => {
    setExpandedTxns((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  };

  const displayedTxns = (activeTab === 'all' ? sales : mySales) ?? [];
  const monthLabel = monthly?.period.month ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track all sales records{monthly ? ` · ${monthly.sales.count.toLocaleString()} this month` : ''}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          style={{ boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }}
        >
          <Plus size={15} /> Record Sale
        </button>
      </div>

      {/* Stat cards + chart — admin only */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Monthly Sales" value={monthly ? monthly.sales.count.toLocaleString() : '—'} sub={monthLabel} icon={ShoppingCart} accentColor="#1a7a4a" iconBg="bg-[#e8f5ee]" iconColor="text-[#1a7a4a]" />
            <StatCard label="Monthly Revenue" value={monthly ? `₦${monthly.sales.revenue.toLocaleString()}` : '—'} sub={monthLabel} icon={Wallet} accentColor="#0d9488" iconBg="bg-teal-500/10" iconColor="text-[#0d9488]" />
            <StatCard label="Avg. Sale Value" value={monthly ? `₦${Math.round(monthly.sales.averageSale).toLocaleString()}` : '—'} sub={monthLabel} icon={TrendingUp} accentColor="#16a34a" iconBg="bg-green-500/10" iconColor="text-green-600" />
          </div>
          <RevenueChart data={chartData} startDate={CHART_START} endDate={CHART_END} profitByDate={profitByDate} />
        </>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {([['all', 'All Sales'], ['mine', 'My Sales']] as [ActiveTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'all' && (
          <div className="relative w-full max-w-xs mb-1.5">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            {!searchQuery && (
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none flex items-center gap-1">
                Search by{' '}
                <span className={`transition-opacity duration-300 ${phVisible ? 'opacity-100' : 'opacity-0'}`}>
                  {PLACEHOLDERS[phIndex]}
                </span>
              </span>
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-transparent"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                {['', '#', 'Items', 'Customer', 'Amount', 'Profit', 'Date', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                      i === 0 ? 'w-8 rounded-tl-2xl' : i === 7 ? 'rounded-tr-2xl' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : displayedTxns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <ShoppingCart size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {activeTab === 'mine' ? 'You have no recorded sales yet' : 'No sales found'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedTxns.map((txn, idx) => {
                  const isMulti = txn.itemCount > 1;
                  const isExpanded = expandedTxns.has(txn.transactionId);
                  const profit = txn.items.reduce((s, i) => s + (i.amount - i.costPrice), 0);

                  const txnDiscount = txn.items.reduce((s, i) => s + (i.discountAmount ?? 0), 0);
                  const txnListTotal = txn.items.reduce((s, i) => s + (i.listPrice ?? i.amount), 0);

                  return (
                    <React.Fragment key={txn.transactionId}>
                      {/* Transaction row */}
                      <tr
                        className={`hover:bg-primary/5 transition-colors ${isExpanded ? 'bg-primary/[0.03]' : ''}`}
                      >
                        {/* Expand toggle */}
                        <td className="px-3 py-3 w-8">
                          {isMulti && (
                            <button
                              onClick={() => toggleExpand(txn.transactionId)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronRightIcon
                                size={14}
                                className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td className="px-3 py-3 font-semibold text-[13.5px]">
                          {isMulti ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                                {txn.itemCount}
                              </span>
                              <span className="text-muted-foreground font-normal">items</span>
                            </span>
                          ) : (
                            txn.items[0]?.productName ?? '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-muted-foreground">{txn.customerName}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[14px]">₦{txn.total.toLocaleString()}</span>
                            {txnDiscount > 0 && (
                              <>
                                <span className="text-[12px] text-muted-foreground line-through">
                                  ₦{txnListTotal.toLocaleString()}
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e8f5ee] text-[#1a7a4a] border border-[#1a7a4a]/20">
                                  −₦{txnDiscount.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-3 font-semibold text-[13.5px] ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          ₦{profit.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(txn.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setDetailTxn(txn)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>

                      {/* Expanded item rows */}
                      {isExpanded && txn.items.map((item) => {
                        const itemDiscount = item.discountAmount ?? 0;
                        return (
                          <tr key={item.id} className="bg-muted/20 border-t border-dashed border-border/50">
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 pl-6 text-[12.5px] font-medium text-foreground">
                              {item.productName}
                            </td>
                            <td className="px-3 py-2 text-[12px] text-muted-foreground">
                              ×{item.quantity} @ ₦{item.unitPrice.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13px] font-semibold">₦{item.finalPrice.toLocaleString()}</span>
                                {itemDiscount > 0 && (
                                  <>
                                    <span className="text-[11px] text-muted-foreground line-through">
                                      ₦{item.listPrice.toLocaleString()}
                                    </span>
                                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-[#e8f5ee] text-[#1a7a4a] border border-[#1a7a4a]/20">
                                      −₦{itemDiscount.toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-[12px] text-muted-foreground">
                              ₦{(item.amount - item.costPrice).toLocaleString()} profit
                            </td>
                            <td colSpan={2} />
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{displayedTxns.length}</span> of{' '}
          <span className="font-semibold text-foreground">{total}</span> transactions
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(page - 1)} disabled={page === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    n === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Record Sale Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-card rounded-2xl border border-border p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            {submitting && (
              <div className="absolute inset-0 bg-card/85 rounded-2xl flex items-center justify-center z-10 gap-3">
                <div className="h-5 w-5 rounded-full border-[2.5px] border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-semibold">Recording sale…</span>
              </div>
            )}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-[17px] font-bold">Record Sale</h2>
                <p className="text-xs text-muted-foreground mt-1">Add one or more items, then fill in customer details</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <SaleForm
              onSubmit={handleSubmit}
              isLoading={submitting}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {detailTxn && (
        <TransactionModal
          txn={detailTxn}
          onClose={() => setDetailTxn(null)}
          onReceipt={handleViewReceipt}
        />
      )}
    </div>
  );
}
