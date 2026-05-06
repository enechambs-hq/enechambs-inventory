'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart2, Package, TrendingUp, ShoppingBag, Award } from 'lucide-react';
import { toast } from 'sonner';
import { reportsService } from '@/lib/services/reports.service';
import { SalesReport, StockReport, CategoryReport } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'stock' | 'category';
type Preset = '7d' | '30d' | '90d';

function fmtNGN(n: number) {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset: Preset): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (preset === '7d' ? 7 : preset === '30d' ? 30 : 90));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function formatDisplayDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'sales', label: 'Sales Report' },
    { id: 'stock', label: 'Stock Report' },
    { id: 'category', label: 'Category Report' },
  ];
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-5">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="px-4 py-2.5 text-[13.5px] transition-colors rounded-t-lg"
            style={{
              color: isActive ? '#155f3a' : '#5a6660',
              fontWeight: isActive ? 600 : 500,
              background: isActive ? '#e8f5ee' : 'transparent',
              marginBottom: -1,
              borderTopStyle: 'none',
              borderLeftStyle: 'none',
              borderRightStyle: 'none',
              borderBottomStyle: 'solid',
              borderBottomWidth: 2,
              borderBottomColor: isActive ? '#1a7a4a' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function DateRangePicker({
  startDate,
  endDate,
  activePreset,
  onStartChange,
  onEndChange,
  onPreset,
  onGenerate,
  isLoading,
}: {
  startDate: string;
  endDate: string;
  activePreset: Preset | null;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onPreset: (p: Preset) => void;
  onGenerate: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5 p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Start Date</p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
        />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">End Date</p>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20"
        />
      </div>
      <div className="flex gap-1.5">
        {(['7d', '30d', '90d'] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => onPreset(p)}
            className="h-9 px-3 rounded-lg border text-[12.5px] font-medium transition-colors"
            style={{
              background: activePreset === p ? '#e8f5ee' : '#fff',
              color: activePreset === p ? '#155f3a' : '#3a4640',
              borderColor: activePreset === p ? '#b6dfc9' : '#e5e7e6',
              fontWeight: activePreset === p ? 600 : 500,
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="h-9 px-4 rounded-lg bg-[#1a7a4a] text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-[#145c37] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <BarChart2 size={14} />
        Generate Report
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  green,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  green?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: green ? '#1a7a4a' : '#e8f5ee', color: green ? '#fff' : '#155f3a' }}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>
        <p className="text-[12px] text-gray-400 font-medium">{label}</p>
      </div>
      <p
        className="text-[22px] font-bold tracking-tight tabular-nums mt-0.5"
        style={{ color: green ? '#155f3a' : '#111827' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11.5px] text-gray-400">{sub}</p>}
    </div>
  );
}

function ReportCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {children}
    </div>
  );
}

function CardHeader({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
      <span className="text-[14px] font-semibold text-gray-900">{title}</span>
      {count != null && (
        <span className="text-[11.5px] font-semibold text-[#155f3a] bg-[#e8f5ee] px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
      <div className="flex-1" />
      {hint && <span className="text-[12px] text-gray-400">{hint}</span>}
    </div>
  );
}


// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonPulse({ w, h = 12, r = 4 }: { w: number; h?: number; r?: number }) {
  return (
    <div
      className="bg-gray-200 animate-pulse"
      style={{ width: w, height: h, borderRadius: r }}
    />
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      {/* stat cards */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
            <SkeletonPulse w={28} h={28} r={7} />
            <SkeletonPulse w={130 - i * 10} h={20} />
            <SkeletonPulse w={90} h={9} />
          </div>
        ))}
      </div>
      {/* table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
          <SkeletonPulse w={140} h={12} /> <SkeletonPulse w={28} h={16} r={999} />
          <div className="flex-1" /> <SkeletonPulse w={100} h={9} />
        </div>
        <div className="px-5 py-2.5 bg-gray-50/60 border-b border-gray-100 flex gap-4">
          {[100, 70, 90, 80].map((w, i) => <SkeletonPulse key={i} w={w} h={9} />)}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
            <SkeletonPulse w={34} h={34} r={9} />
            <div className="flex-1 space-y-1.5">
              <SkeletonPulse w={150 - i * 8} h={11} />
              <SkeletonPulse w={90} h={8} />
            </div>
            <SkeletonPulse w={50} h={11} />
            <SkeletonPulse w={80} h={11} />
            <SkeletonPulse w={70} h={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StockSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <SkeletonPulse w={140} h={12} /> <SkeletonPulse w={28} h={16} r={999} />
        <div className="flex-1" /> <SkeletonPulse w={100} h={9} />
      </div>
      <div className="px-5 py-2.5 bg-gray-50/60 border-b border-gray-100 flex gap-4">
        {[100, 80, 70, 90, 60, 70].map((w, i) => <SkeletonPulse key={i} w={w} h={9} />)}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
          <SkeletonPulse w={34} h={34} r={9} />
          <div className="flex-1 space-y-1.5">
            <SkeletonPulse w={150 - i * 8} h={11} />
            <SkeletonPulse w={80} h={8} />
          </div>
          <SkeletonPulse w={70} h={11} />
          <SkeletonPulse w={50} h={11} />
          <SkeletonPulse w={50} h={11} />
          <SkeletonPulse w={70} h={20} r={999} />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyReport({ onReset, onGenerate }: { onReset: () => void; onGenerate: () => void }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-8 py-16 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f0f9f4] border border-[#c9e8d8] flex items-center justify-center mb-4">
        <BarChart2 size={30} className="text-[#1a7a4a]" strokeWidth={1.4} />
      </div>
      <p className="text-[17px] font-semibold text-gray-900 tracking-tight">No data for this period</p>
      <p className="mt-1.5 text-[13.5px] text-gray-400 max-w-sm leading-relaxed">
        Try widening the date range, or check back after recording a few sales. Reports populate as activity happens.
      </p>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onReset}
          className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Reset to last 30 days
        </button>
        <button
          onClick={onGenerate}
          className="h-9 px-4 rounded-lg bg-[#1a7a4a] text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#145c37] transition-colors"
        >
          <BarChart2 size={14} /> Generate Report
        </button>
      </div>
    </div>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────

function SalesTab({ report }: { report: SalesReport }) {
  const { summary, topProducts } = report;
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="flex gap-3">
        <StatCard
          label="Total Revenue"
          value={fmtNGN(summary.totalRevenue)}
          icon={TrendingUp}
          green
        />
        <StatCard
          label="Total Sales"
          value={summary.totalSales.toLocaleString()}
          icon={ShoppingBag}
        />
        <StatCard
          label="Avg Sale Value"
          value={fmtNGN(summary.averageSaleValue)}
          icon={BarChart2}
        />
        <StatCard
          label="Top Product"
          value={summary.topProduct?.name ?? '—'}
          sub={
            summary.topProduct
              ? `${summary.topProduct.qtySold} sold · ${fmtNGN(summary.topProduct.revenue)}`
              : undefined
          }
          icon={Award}
        />
      </div>

      {/* Top products table */}
      <ReportCard>
        <CardHeader title="Top 10 products" count={topProducts.length} hint="Sorted by qty sold" />
        <div
          className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
          style={{ gridTemplateColumns: '2fr 110px 180px 160px' }}
        >
          {[
            { label: 'Product Name', align: 'left' },
            { label: 'Qty Sold', align: 'right' },
            { label: 'Revenue', align: 'right' },
            { label: 'Date', align: 'left' },
          ].map((c) => (
            <div
              key={c.label}
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
              style={{ textAlign: c.align as 'left' | 'right' }}
            >
              {c.label}
            </div>
          ))}
        </div>
        {topProducts.map((p, i) => (
          <div
            key={p.productName + i}
            className="grid items-center px-5 py-3.5"
            style={{
              gridTemplateColumns: '2fr 110px 180px 160px',
              borderBottom: i < topProducts.length - 1 ? '1px solid #f3f4f3' : 'none',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
                <Package size={15} className="text-[#1a7a4a]" strokeWidth={1.7} />
              </div>
              <span className="text-[13.5px] font-semibold text-gray-900 truncate">{p.productName}</span>
            </div>
            <div className="text-right text-[13.5px] font-medium tabular-nums text-gray-700">
              {p.qtySold}
            </div>
            <div className="text-right text-[13.5px] font-semibold tabular-nums text-[#155f3a]">
              {fmtNGN(p.revenue)}
            </div>
            <div className="text-[13px] text-gray-400">{formatDisplayDate(p.date)}</div>
          </div>
        ))}
        {topProducts.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No sales in this period</div>
        )}
      </ReportCard>
    </div>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────

function StockTab({ report }: { report: StockReport }) {
  const { items, totalProducts, lowStockCount } = report;
  return (
    <ReportCard>
      <CardHeader
        title="Inventory health"
        count={totalProducts}
        hint={lowStockCount > 0 ? `${lowStockCount} low stock` : 'All well stocked'}
      />
      <div
        className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
        style={{ gridTemplateColumns: '1.8fr 1.2fr 110px 130px 90px 110px' }}
      >
        {[
          { label: 'Product Name', align: 'left' },
          { label: 'Category', align: 'left' },
          { label: 'Current Qty', align: 'right' },
          { label: 'Min Threshold', align: 'right' },
          { label: 'Unit', align: 'left' },
          { label: 'Status', align: 'left' },
        ].map((c) => (
          <div
            key={c.label}
            className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
            style={{ textAlign: c.align as 'left' | 'right' }}
          >
            {c.label}
          </div>
        ))}
      </div>
      {items.map((item, i) => (
        <div
          key={item.id}
          className="grid items-center px-5 py-3.5"
          style={{
            gridTemplateColumns: '1.8fr 1.2fr 110px 130px 90px 110px',
            borderBottom: i < items.length - 1 ? '1px solid #f3f4f3' : 'none',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
              <Package size={15} className="text-[#1a7a4a]" strokeWidth={1.7} />
            </div>
            <span className="text-[13.5px] font-semibold text-gray-900 truncate">{item.productName}</span>
          </div>
          <div className="text-[13px] text-gray-500">{item.categoryName ?? <span className="italic text-gray-300">—</span>}</div>
          <div
            className="text-right text-[13.5px] font-semibold tabular-nums"
            style={{ color: item.isLowStock ? '#9b1d10' : '#111827' }}
          >
            {item.quantity}
          </div>
          <div className="text-right text-[13px] tabular-nums text-gray-400">{item.restockThreshold}</div>
          <div className="text-[13px] text-gray-400 capitalize">{item.unit}</div>
          <div>
            {item.isLowStock ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ color: '#8a5a0a', background: '#fff5e0' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e09515' }} />
                Low Stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full text-[#155f3a] bg-[#e8f5ee]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a7a4a]" />
                OK
              </span>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No inventory items found</div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
        <p className="text-[12px] text-gray-400">
          Showing <span className="font-medium text-gray-600">{totalProducts}</span> products ·{' '}
          <span className="font-medium" style={{ color: lowStockCount > 0 ? '#8a5a0a' : '#155f3a' }}>
            {lowStockCount} low stock
          </span>
        </p>
      </div>
    </ReportCard>
  );
}

// ─── Category Tab ─────────────────────────────────────────────────────────────

function CategoryTab({ report }: { report: CategoryReport }) {
  const { categories } = report;
  const maxRevenue = Math.max(...categories.map((c) => c.totalRevenue), 1);
  return (
    <ReportCard>
      <CardHeader title="Performance by category" count={categories.length} hint="Sorted by revenue" />
      <div
        className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
        style={{ gridTemplateColumns: '1.8fr 2fr 140px 140px' }}
      >
        {[
          { label: 'Category Name', align: 'left' },
          { label: 'Total Revenue', align: 'left' },
          { label: 'Units Sold', align: 'right' },
          { label: 'Transactions', align: 'right' },
        ].map((c) => (
          <div
            key={c.label}
            className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
            style={{ textAlign: c.align as 'left' | 'right' }}
          >
            {c.label}
          </div>
        ))}
      </div>
      {categories.map((cat, i) => (
        <div
          key={cat.categoryId}
          className="grid items-center px-5 py-3.5"
          style={{
            gridTemplateColumns: '1.8fr 2fr 140px 140px',
            borderBottom: i < categories.length - 1 ? '1px solid #f3f4f3' : 'none',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
              <Package size={15} className="text-[#1a7a4a]" strokeWidth={1.7} />
            </div>
            <span className="text-[13.5px] font-semibold text-gray-900">{cat.categoryName}</span>
          </div>
          <div className="flex items-center gap-3 pr-4">
            <div className="flex-1 h-2 rounded-full bg-[#f0f9f4] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1a7a4a]"
                style={{ width: `${(cat.totalRevenue / maxRevenue) * 100}%` }}
              />
            </div>
            <span className="text-[13.5px] font-semibold tabular-nums text-[#155f3a] min-w-[90px] text-right">
              {fmtNGN(cat.totalRevenue)}
            </span>
          </div>
          <div className="text-right text-[13.5px] font-medium tabular-nums text-gray-700">
            {cat.unitsSold}
          </div>
          <div className="text-right text-[13px] tabular-nums text-gray-400">
            {cat.totalTransactions}
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-gray-400">No category data in this period</div>
      )}
    </ReportCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [preset, setPreset] = useState<Preset>('30d');
  const [startDate, setStartDate] = useState(getPresetDates('30d').startDate);
  const [endDate, setEndDate] = useState(getPresetDates('30d').endDate);
  const [isLoading, setIsLoading] = useState(false);

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport | null>(null);
  const [categoryReport, setCategoryReport] = useState<CategoryReport | null>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const { startDate: s, endDate: e } = getPresetDates(p);
    setStartDate(s);
    setEndDate(e);
  };

  const fetchReport = useCallback(
    async (tab: Tab, sd: string, ed: string) => {
      setIsLoading(true);
      try {
        if (tab === 'sales') {
          const data = await reportsService.getSalesReport(sd, ed);
          setSalesReport(data);
        } else if (tab === 'stock') {
          const data = await reportsService.getStockReport();
          setStockReport(data);
        } else {
          const data = await reportsService.getCategoryReport(sd, ed);
          setCategoryReport(data);
        }
      } catch {
        toast.error('Failed to load report');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Fetch on mount and when tab changes
  useEffect(() => {
    fetchReport(activeTab, startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleGenerate = () => fetchReport(activeTab, startDate, endDate);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleReset = () => {
    applyPreset('30d');
    fetchReport(activeTab, getPresetDates('30d').startDate, getPresetDates('30d').endDate);
  };

  const showDatePicker = activeTab !== 'stock';

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your sales, stock and category performance over time.</p>
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={handleTabChange} />

      {/* Date Range Picker */}
      {showDatePicker && (
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          activePreset={preset}
          onStartChange={(v) => { setStartDate(v); setPreset(null as unknown as Preset); }}
          onEndChange={(v) => { setEndDate(v); setPreset(null as unknown as Preset); }}
          onPreset={(p) => applyPreset(p)}
          onGenerate={handleGenerate}
          isLoading={isLoading}
        />
      )}

      {/* Content */}
      {isLoading ? (
        activeTab === 'stock' ? <StockSkeleton /> : <ReportsSkeleton />
      ) : activeTab === 'sales' ? (
        salesReport && salesReport.topProducts.length > 0 ? (
          <SalesTab report={salesReport} />
        ) : salesReport ? (
          <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
        ) : null
      ) : activeTab === 'stock' ? (
        stockReport ? (
          <StockTab report={stockReport} />
        ) : null
      ) : categoryReport && categoryReport.categories.length > 0 ? (
        <CategoryTab report={categoryReport} />
      ) : categoryReport ? (
        <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
      ) : null}
    </div>
  );
}
