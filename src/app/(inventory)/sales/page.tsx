'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import {
  Plus, Receipt, ChevronLeft, ChevronRight, X, Search,
  ShoppingCart, Wallet, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useSalesStore } from '@/store/sales.store';
import { salesService } from '@/lib/services/sales.service';
import { dashboardService, DashboardStats, RevenueDataPoint } from '@/lib/services/dashboard.service';
import { CreateSaleDto, Sale } from '@/types';
import SaleForm from '@/components/shared/SaleForm';

type ActiveTab = 'all' | 'mine';

/* ── helpers ─────────────────────────────────────── */
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

/* ── StatCard ─────────────────────────────────────── */
function StatCard({
  label, value, sub, icon, accentColor, iconBg,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accentColor: string; iconBg: string;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
          opacity: 0.13,
        }}
      />
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl"
        style={{ backgroundColor: accentColor, opacity: 0.15 }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11.5px] font-medium text-muted-foreground leading-tight">{label}</p>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
        </div>
        <p className="text-[25px] font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
          {value}
        </p>
        {sub && <p className="text-[11.5px] text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Revenue Chart ────────────────────────────────── */
function RevenueChart({ data, startDate, endDate }: {
  data: RevenueDataPoint[]; startDate: string; endDate: string;
}) {
  const filled = fillGaps(data, startDate, endDate);
  const chartData = filled.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    Revenue: Number(d.total),
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-bold">Sales Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue — last 14 days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
          <span className="text-xs text-muted-foreground">Revenue</span>
        </div>
      </div>
      {chartData.every((d) => d.Revenue === 0) ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No revenue data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="salesRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false} interval={1}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false} width={56}
              tickFormatter={(v) => v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 10,
                fontSize: 12,
                boxShadow: '0 8px 24px rgba(20,40,100,0.12)',
              }}
              formatter={(v) => [`₦${Number(v).toLocaleString()}`, 'Revenue']}
              cursor={{ stroke: '#5d8df4', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone" dataKey="Revenue"
              stroke="#2563eb" strokeWidth={2}
              fill="url(#salesRevGrad)" dot={false}
              activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ── Sale Detail Modal ────────────────────────────── */
function SaleDetailModal({ sale, onClose, onReceipt }: {
  sale: Sale; onClose: () => void; onReceipt: (id: string) => void;
}) {
  const profit = sale.amount - sale.costPrice;
  const margin = sale.amount > 0 ? ((profit / sale.amount) * 100).toFixed(1) : '0.0';

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl border border-border p-7 w-full max-w-[480px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt size={17} className="text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold">Sale #{sale.serialNumber}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(sale.date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Product */}
        <div className="bg-background rounded-xl p-4 mb-3 border border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Product</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {([
              ['Name', sale.productName],
              ['Color', sale.color],
              ['Storage', sale.storageGB],
              ['IMEI', sale.imei],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l}>
                <p className="text-[11px] text-muted-foreground mb-0.5">{l}</p>
                <p className={`text-[13.5px] font-semibold ${l === 'IMEI' ? 'font-mono text-xs' : ''}`}>
                  {v || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {[
            { label: 'Cost', value: `₦${sale.costPrice.toLocaleString()}`, cls: 'text-muted-foreground' },
            { label: 'Revenue', value: `₦${sale.amount.toLocaleString()}`, cls: 'text-blue-600' },
            { label: 'Profit', value: `₦${profit.toLocaleString()}`, cls: profit >= 0 ? 'text-green-600' : 'text-red-500' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-background rounded-xl p-3 border border-border">
              <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
              <p className={`text-[17px] font-extrabold tracking-tight ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Transaction Details */}
        <div className="bg-background rounded-xl p-4 border border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Transaction Details</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Customer</p>
              <p className="text-[13.5px] font-semibold">{sale.customerName}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Phone</p>
              <p className="text-[13.5px] font-semibold">{sale.customerPhone}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Account Paid To</p>
              <p className="text-[13.5px] font-semibold">{sale.accountPaidTo}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Condition</p>
              <p className="text-[13.5px] font-semibold capitalize">{sale.condition}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Profit Margin</p>
              <p className={`text-[13.5px] font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {margin}%
              </p>
            </div>
          </div>
        </div>

        {/* View receipt */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onReceipt(sale.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Receipt size={14} />
            View Receipt
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<RevenueDataPoint[]>([]);

  // Animated search placeholder
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

  // Fetch stats + chart once
  useEffect(() => {
    dashboardService.getStats().then(setStats).catch(() => {});
    dashboardService.getRevenueChart(CHART_START, CHART_END).then(setChartData).catch(() => {});
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await salesService.getAll({
        page, limit,
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
    if (activeTab === 'all') fetchSales();
    else fetchMySales();
  }, [activeTab, fetchSales, fetchMySales]);

  const handleSubmit = async (data: CreateSaleDto) => {
    try {
      setSubmitting(true);
      await salesService.create(data);
      toast.success('Sale recorded successfully');
      setModalOpen(false);
      fetchSales();
      dashboardService.getStats().then(setStats).catch(() => {});
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
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error('Failed to load receipt');
    }
  };

  const displayedSales = (activeTab === 'all' ? sales : mySales) ?? [];
  const avgSale = stats && stats.totalSales > 0
    ? Math.round(stats.totalRevenue / stats.totalSales)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track all sales records{stats ? ` · ${stats.totalSales.toLocaleString()} total` : ''}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          style={{ boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
        >
          <Plus size={15} />
          Record Sale
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Sales"
          value={stats ? stats.totalSales.toLocaleString() : '—'}
          icon={<ShoppingCart size={16} className="text-blue-600" />}
          accentColor="#2563eb"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          label="Total Revenue"
          value={stats ? `₦${(stats.totalRevenue / 1_000_000).toFixed(2)}M` : '—'}
          sub={stats ? `₦${stats.totalRevenue.toLocaleString()} all time` : undefined}
          icon={<Wallet size={16} className="text-purple-600" />}
          accentColor="#7c3aed"
          iconBg="bg-purple-500/10"
        />
        <StatCard
          label="Avg. Sale Value"
          value={stats ? `₦${avgSale.toLocaleString()}` : '—'}
          icon={<TrendingUp size={16} className="text-amber-600" />}
          accentColor="#d97706"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* Chart */}
      <RevenueChart data={chartData} startDate={CHART_START} endDate={CHART_END} />

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
          <div className="relative w-60 mb-1.5">
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              {['#', 'Product', 'Customer', 'Amount', 'Profit', 'Date', ''].map((h, i) => (
                <th
                  key={i}
                  className={`px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                    i === 0 ? 'rounded-tl-2xl w-8' : i === 6 ? 'rounded-tr-2xl' : ''
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
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                </td>
              </tr>
            ) : displayedSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <ShoppingCart size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'mine' ? 'You have no recorded sales yet' : 'No sales found'}
                  </p>
                </td>
              </tr>
            ) : (
              displayedSales.map((sale, idx) => {
                const profit = sale.amount - sale.costPrice;
                return (
                  <tr key={sale.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3.5 py-3 text-xs font-medium text-muted-foreground">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="px-3.5 py-3">
                      <p className="font-semibold text-[13.5px] leading-tight">{sale.productName}</p>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        {sale.color} · {sale.storageGB}
                      </p>
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-muted-foreground">{sale.customerName}</td>
                    <td className="px-3.5 py-3 font-bold text-[14px]">₦{sale.amount.toLocaleString()}</td>
                    <td className={`px-3.5 py-3 font-semibold text-[13.5px] ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ₦{profit.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(sale.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3.5 py-3">
                      <button
                        onClick={() => setDetailSale(sale)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-semibold text-foreground">{displayedSales.length}</span> of{' '}
          <span className="font-semibold text-foreground">{total}</span> sales
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    n === page
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
            >
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
                <p className="text-xs text-muted-foreground mt-1">Select product and fill in transaction details</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
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

      {/* Sale Detail Modal */}
      {detailSale && (
        <SaleDetailModal
          sale={detailSale}
          onClose={() => setDetailSale(null)}
          onReceipt={handleViewReceipt}
        />
      )}
    </div>
  );
}
