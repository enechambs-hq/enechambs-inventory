'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart2, Package, TrendingUp, ShoppingBag, Award, DollarSign, Users, TrendingDown, Tag, Lock } from 'lucide-react';
import { NumericInput } from '@/components/shared/NumericInput';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';
import { reportsService } from '@/lib/services/reports.service';
import { expensesService } from '@/lib/services/expenses.service';
import { monthlyOpeningService } from '@/lib/services/monthlyOpening.service';
import { SalesReport, StockReport, CategoryReport, ProfitReport, ExpenseSummary, ExpenseCategoryType, MonthlyReport } from '@/types';
import { StatCard } from '@/components/shared/StatCard';
import { formatUnit } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'stock' | 'category' | 'profit' | 'expenses' | 'monthly';
type Preset = 'month' | '7d' | '30d' | '90d';

function fmtNGN(n: number) {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset: Preset): { startDate: string; endDate: string } {
  const end = new Date();
  if (preset === 'month') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { startDate: isoDate(start), endDate: isoDate(end) };
  }
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

function TabBar({ active, onChange, isAdmin }: { active: Tab; onChange: (t: Tab) => void; isAdmin: boolean }) {
  const allTabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'sales', label: 'Sales Report' },
    { id: 'stock', label: 'Stock Report' },
    { id: 'category', label: 'Category Report', adminOnly: true },
    { id: 'profit', label: 'Profit Report', adminOnly: true },
    { id: 'expenses', label: 'Expenses Report', adminOnly: true },
    { id: 'monthly', label: 'Monthly P&L', adminOnly: true },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin);
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
        {([
          { id: 'month', label: 'This Month' },
          { id: '7d', label: '7d' },
          { id: '30d', label: '30d' },
          { id: '90d', label: '90d' },
        ] as { id: Preset; label: string }[]).map((p) => (
          <button
            key={p.id}
            onClick={() => onPreset(p.id)}
            className="h-9 px-3 rounded-lg border text-[12.5px] font-medium transition-colors"
            style={{
              background: activePreset === p.id ? '#e8f5ee' : '#fff',
              color: activePreset === p.id ? '#155f3a' : '#3a4640',
              borderColor: activePreset === p.id ? '#b6dfc9' : '#e5e7e6',
              fontWeight: activePreset === p.id ? 600 : 500,
            }}
          >
            {p.label}
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

function SalesTab({ report, isAdmin }: { report: SalesReport; isAdmin: boolean }) {
  const { summary, topProducts } = report;
  return (
    <div className="space-y-4">
      {/* Summary cards — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Monthly Revenue"
            value={fmtNGN(summary.totalRevenue)}
            icon={TrendingUp}
            accentColor="#1a7a4a"
            iconBg="bg-[#e8f5ee]"
            iconColor="text-[#1a7a4a]"
          />
          <StatCard
            label="Monthly Sales"
            value={summary.totalSales.toLocaleString()}
            icon={ShoppingBag}
            accentColor="#0d9488"
            iconBg="bg-teal-500/10"
            iconColor="text-[#0d9488]"
          />
          <StatCard
            label="Avg Sale Value"
            value={fmtNGN(summary.averageSaleValue)}
            icon={BarChart2}
            accentColor="#16a34a"
            iconBg="bg-green-500/10"
            iconColor="text-green-600"
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
            accentColor="#155f3a"
            iconBg="bg-[#e8f5ee]"
            iconColor="text-[#155f3a]"
          />
        </div>
      )}

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
        style={{ gridTemplateColumns: '1.8fr 1.2fr 130px 130px 110px' }}
      >
        {[
          { label: 'Product Name', align: 'left' },
          { label: 'Category', align: 'left' },
          { label: 'Current Qty', align: 'right' },
          { label: 'Min Threshold', align: 'right' },
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13.5px] font-semibold text-gray-900 truncate">
                {item.productName}
              </span>
              {item.variant && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/10 text-green-700 border border-green-500/20 whitespace-nowrap shrink-0">
                  {item.variant}
                </span>
              )}
            </div>
          </div>
          <div className="text-[13px] text-gray-500">{item.categoryName ?? <span className="italic text-gray-300">—</span>}</div>
          <div
            className="text-right text-[13.5px] font-semibold tabular-nums"
            style={{ color: item.isLowStock ? '#9b1d10' : '#111827' }}
          >
            {formatUnit(Number(item.quantity), item.unit)}
          </div>
          <div className="text-right text-[13px] tabular-nums text-gray-400">{item.restockThreshold}</div>
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

// ─── Profit Tab ───────────────────────────────────────────────────────────────

function ProfitTab({ report, expenseTotal }: { report: ProfitReport; expenseTotal: number }) {
  const { summary, byProduct, byStaff } = report;
  const maxProfit = Math.max(...byProduct.map((p) => p.profit), 1);
  const netProfit = summary.totalProfit - expenseTotal;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={fmtNGN(summary.totalRevenue)}
          icon={TrendingUp}
          accentColor="#1a7a4a"
          iconBg="bg-[#e8f5ee]"
          iconColor="text-[#1a7a4a]"
        />
        <StatCard
          label="Gross Profit"
          value={fmtNGN(summary.totalProfit)}
          sub={`${summary.profitMargin.toFixed(1)}% margin · ${summary.totalSales} sales`}
          icon={DollarSign}
          accentColor="#15803d"
          iconBg="bg-green-500/10"
          iconColor="text-green-700"
        />
        <StatCard
          label="Net Profit (after expenses)"
          value={fmtNGN(netProfit)}
          sub={expenseTotal > 0 ? `−${fmtNGN(expenseTotal)} expenses` : 'No expenses recorded'}
          icon={BarChart2}
          accentColor={netProfit >= 0 ? '#0d9488' : '#dc2626'}
          iconBg={netProfit >= 0 ? 'bg-teal-500/10' : 'bg-red-500/10'}
          iconColor={netProfit >= 0 ? 'text-[#0d9488]' : 'text-red-600'}
        />
      </div>

      {/* By product */}
      <ReportCard>
        <CardHeader title="Profit by product" count={byProduct.length} hint="Sorted by profit" />
        <div
          className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
          style={{ gridTemplateColumns: '2fr 2fr 150px 150px' }}
        >
          {[
            { label: 'Product', align: 'left' },
            { label: 'Profit', align: 'left' },
            { label: 'Revenue', align: 'right' },
            { label: 'Cost', align: 'right' },
          ].map((c) => (
            <div key={c.label} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide" style={{ textAlign: c.align as 'left' | 'right' }}>
              {c.label}
            </div>
          ))}
        </div>
        {byProduct.map((p, i) => (
          <div
            key={p.productName}
            className="grid items-center px-5 py-3.5"
            style={{ gridTemplateColumns: '2fr 2fr 150px 150px', borderBottom: i < byProduct.length - 1 ? '1px solid #f3f4f3' : 'none' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#e8f5ee] flex items-center justify-center shrink-0">
                <Package size={15} className="text-[#1a7a4a]" strokeWidth={1.7} />
              </div>
              <span className="text-[13.5px] font-semibold text-gray-900 truncate">{p.productName}</span>
            </div>
            <div className="flex items-center gap-3 pr-4">
              <div className="flex-1 h-2 rounded-full bg-[#f0f9f4] overflow-hidden">
                <div className="h-full rounded-full bg-[#1a7a4a]" style={{ width: `${(p.profit / maxProfit) * 100}%` }} />
              </div>
              <span className="text-[13.5px] font-semibold tabular-nums text-[#155f3a] min-w-[80px] text-right">{fmtNGN(p.profit)}</span>
            </div>
            <div className="text-right text-[13px] tabular-nums text-gray-500">{fmtNGN(p.revenue)}</div>
            <div className="text-right text-[13px] tabular-nums text-gray-400">{fmtNGN(p.cost)}</div>
          </div>
        ))}
        {byProduct.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No data for this period</div>
        )}
      </ReportCard>

      {/* By staff */}
      <ReportCard>
        <CardHeader title="Profit by staff" count={byStaff.length} />
        <div
          className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
          style={{ gridTemplateColumns: '2fr 120px 150px 150px 150px' }}
        >
          {[
            { label: 'Staff', align: 'left' },
            { label: 'Sales', align: 'right' },
            { label: 'Revenue', align: 'right' },
            { label: 'Cost', align: 'right' },
            { label: 'Profit', align: 'right' },
          ].map((c) => (
            <div key={c.label} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide" style={{ textAlign: c.align as 'left' | 'right' }}>
              {c.label}
            </div>
          ))}
        </div>
        {byStaff.map((s, i) => (
          <div
            key={s.staffName}
            className="grid items-center px-5 py-3.5"
            style={{ gridTemplateColumns: '2fr 120px 150px 150px 150px', borderBottom: i < byStaff.length - 1 ? '1px solid #f3f4f3' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#e8f5ee] flex items-center justify-center shrink-0">
                <Users size={14} className="text-[#1a7a4a]" strokeWidth={1.7} />
              </div>
              <span className="text-[13.5px] font-semibold text-gray-900">{s.staffName}</span>
            </div>
            <div className="text-right text-[13px] tabular-nums text-gray-500">{s.totalSales}</div>
            <div className="text-right text-[13px] tabular-nums text-gray-500">{fmtNGN(s.revenue)}</div>
            <div className="text-right text-[13px] tabular-nums text-gray-400">{fmtNGN(s.cost)}</div>
            <div className="text-right text-[13.5px] font-semibold tabular-nums text-[#155f3a]">{fmtNGN(s.profit)}</div>
          </div>
        ))}
        {byStaff.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No data for this period</div>
        )}
      </ReportCard>
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

const TYPE_CLS: Record<ExpenseCategoryType, string> = {
  overhead: 'bg-amber-500/10 text-amber-700',
  operational: 'bg-blue-500/10 text-blue-700',
  other: 'bg-gray-100 text-gray-500',
};

function ExpensesTab({ report }: { report: ExpenseSummary }) {
  const { totalAmount, byCategory, byMonth } = report;
  const totalEntries = byCategory.reduce((s, c) => s + c.count, 0);
  const topCat = [...byCategory].sort((a, b) => b.total - a.total)[0];
  const maxCatTotal = Math.max(...byCategory.map((c) => c.total), 1);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Expenses"
          value={fmtNGN(totalAmount)}
          icon={TrendingDown}
          accentColor="#e05a3a"
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          label="Total Entries"
          value={totalEntries.toLocaleString()}
          sub="individual expense records"
          icon={Tag}
          accentColor="#0369a1"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Biggest Category"
          value={topCat?.categoryName ?? '—'}
          sub={topCat ? `${fmtNGN(topCat.total)} · ${topCat.count} entries` : undefined}
          icon={BarChart2}
          accentColor="#b45309"
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
        />
      </div>

      {/* By category */}
      <ReportCard>
        <CardHeader title="Breakdown by category" count={byCategory.length} hint="Sorted by amount" />
        <div
          className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
          style={{ gridTemplateColumns: '2fr 2fr 120px 100px' }}
        >
          {[
            { label: 'Category', align: 'left' },
            { label: 'Total Spend', align: 'left' },
            { label: 'Entries', align: 'right' },
            { label: 'Type', align: 'left' },
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
        {[...byCategory]
          .sort((a, b) => b.total - a.total)
          .map((cat, i) => (
            <div
              key={cat.categoryId}
              className="grid items-center px-5 py-3.5"
              style={{
                gridTemplateColumns: '2fr 2fr 120px 100px',
                borderBottom: i < byCategory.length - 1 ? '1px solid #f3f4f3' : 'none',
              }}
            >
              <span className="text-[13.5px] font-semibold text-gray-900">{cat.categoryName}</span>
              <div className="flex items-center gap-3 pr-4">
                <div className="flex-1 h-2 rounded-full bg-red-50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${(cat.total / maxCatTotal) * 100}%` }}
                  />
                </div>
                <span className="text-[13.5px] font-semibold tabular-nums text-red-600 min-w-[90px] text-right">
                  {fmtNGN(cat.total)}
                </span>
              </div>
              <div className="text-right text-[13px] tabular-nums text-gray-500">{cat.count}</div>
              <div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${TYPE_CLS[cat.type]}`}>
                  {cat.type}
                </span>
              </div>
            </div>
          ))}
        {byCategory.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No expenses in this period</div>
        )}
      </ReportCard>

      {/* By month */}
      {byMonth.length > 1 && (
        <ReportCard>
          <CardHeader title="Month-by-month spending" count={byMonth.length} />
          <div
            className="grid px-5 py-2.5 bg-gray-50/60 border-b border-gray-100"
            style={{ gridTemplateColumns: '1fr 2fr 140px' }}
          >
            {['Month', 'Amount', 'Share'].map((h) => (
              <div key={h} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                {h}
              </div>
            ))}
          </div>
          {(() => {
            const maxMonth = Math.max(...byMonth.map((m) => Number(m.total)), 1);
            return [...byMonth].reverse().map((m, i, arr) => (
              <div
                key={m.month}
                className="grid items-center px-5 py-3.5"
                style={{ gridTemplateColumns: '1fr 2fr 140px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f3' : 'none' }}
              >
                <span className="text-[13.5px] font-semibold text-gray-800">
                  {new Date(`${m.month}-01`).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-3 pr-4">
                  <div className="flex-1 h-2 rounded-full bg-red-50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${(Number(m.total) / maxMonth) * 100}%` }}
                    />
                  </div>
                  <span className="text-[13.5px] font-semibold tabular-nums text-red-600 min-w-[90px] text-right">
                    {fmtNGN(Number(m.total))}
                  </span>
                </div>
                <span className="text-[13px] tabular-nums text-gray-400">
                  {totalAmount > 0 ? `${((Number(m.total) / totalAmount) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            ));
          })()}
        </ReportCard>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [preset, setPreset] = useState<Preset>('month');
  const [startDate, setStartDate] = useState(getPresetDates('month').startDate);
  const [endDate, setEndDate] = useState(getPresetDates('month').endDate);
  const [isLoading, setIsLoading] = useState(false);

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [stockReport, setStockReport] = useState<StockReport | null>(null);
  const [categoryReport, setCategoryReport] = useState<CategoryReport | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [expensesReport, setExpensesReport] = useState<ExpenseSummary | null>(null);
  const [profitExpenseTotal, setProfitExpenseTotal] = useState(0);

  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [openingInput, setOpeningInput] = useState('');
  const [savingOpening, setSavingOpening] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

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
        } else if (tab === 'category') {
          const data = await reportsService.getCategoryReport(sd, ed);
          setCategoryReport(data);
        } else if (tab === 'expenses') {
          const data = await expensesService.getSummary(sd, ed);
          setExpensesReport(data);
        } else {
          const [profit, expenses] = await Promise.all([
            reportsService.getProfitReport(sd, ed),
            expensesService.getSummary(sd, ed).catch(() => null),
          ]);
          setProfitReport(profit);
          setProfitExpenseTotal(expenses?.totalAmount ?? 0);
        }
      } catch {
        // fail silently
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

  // Reset to sales if staff lands on an admin-only tab
  useEffect(() => {
    const financialTabs = ['category', 'profit', 'expenses', 'monthly'];
    if (!isAdmin && financialTabs.includes(activeTab as string)) {
      setActiveTab('sales');
    }
  }, [isAdmin, activeTab]);

  const handleGenerate = () => fetchReport(activeTab, startDate, endDate);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleReset = () => {
    applyPreset('month');
    fetchReport(activeTab, getPresetDates('month').startDate, getPresetDates('month').endDate);
  };

  const loadMonthlyReport = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const data = await reportsService.getMonthlyReport(reportMonth, reportYear);
      setMonthlyReport(data);
      setOpeningInput(String(data.openingStockValue || ''));
    } catch {
      // fail silently
    } finally {
      setMonthlyLoading(false);
    }
  }, [reportMonth, reportYear]);

  const saveOpening = async (override = false) => {
    const val = parseFloat(openingInput);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid opening stock value');
      return;
    }

    const dayOfMonth = new Date().getDate();
    const isLocked = dayOfMonth > 7;

    if (isLocked && !override) {
      setShowOverrideConfirm(true);
      return;
    }

    setSavingOpening(true);
    try {
      await monthlyOpeningService.set(reportMonth, reportYear, val, override);
      toast.success(
        override
          ? 'Opening stock overridden successfully'
          : 'Opening stock saved',
      );
      setShowOverrideConfirm(false);
      loadMonthlyReport();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to save opening stock',
      );
    } finally {
      setSavingOpening(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monthly') loadMonthlyReport();
  }, [activeTab, loadMonthlyReport]);

  const showDatePicker = activeTab !== 'stock' && activeTab !== 'monthly';
  const hasEmptyState = activeTab === 'sales' || activeTab === 'category' || activeTab === 'profit' || activeTab === 'expenses';

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your sales, stock and category performance over time.</p>
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={handleTabChange} isAdmin={isAdmin} />

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
          <SalesTab report={salesReport} isAdmin={isAdmin} />
        ) : salesReport ? (
          <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
        ) : null
      ) : activeTab === 'stock' ? (
        stockReport ? <StockTab report={stockReport} /> : null
      ) : activeTab === 'category' ? (
        categoryReport && categoryReport.categories.length > 0 ? (
          <CategoryTab report={categoryReport} />
        ) : categoryReport ? (
          <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
        ) : null
      ) : activeTab === 'profit' ? (
        profitReport && profitReport.byProduct.length > 0 ? (
          <ProfitTab report={profitReport} expenseTotal={profitExpenseTotal} />
        ) : profitReport ? (
          <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
        ) : null
      ) : activeTab === 'expenses' ? (
        expensesReport && expensesReport.byCategory.length > 0 ? (
          <ExpensesTab report={expensesReport} />
        ) : expensesReport ? (
          <EmptyReport onReset={handleReset} onGenerate={handleGenerate} />
        ) : null
      ) : activeTab === 'monthly' ? (
        <MonthlyTab
          month={reportMonth}
          year={reportYear}
          onMonthChange={setReportMonth}
          onYearChange={setReportYear}
          report={monthlyReport}
          loading={monthlyLoading}
          openingInput={openingInput}
          onOpeningChange={setOpeningInput}
          onSaveOpening={saveOpening}
          savingOpening={savingOpening}
          showOverrideConfirm={showOverrideConfirm}
          onOverrideConfirm={() => saveOpening(true)}
          onOverrideCancel={() => setShowOverrideConfirm(false)}
        />
      ) : null}
    </div>
  );
}

const MONTHS_LABELS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function MonthlyTab({
  month, year, onMonthChange, onYearChange,
  report, loading, openingInput, onOpeningChange,
  onSaveOpening, savingOpening,
  showOverrideConfirm, onOverrideConfirm, onOverrideCancel,
}: {
  month: number; year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  report: MonthlyReport | null; loading: boolean;
  openingInput: string;
  onOpeningChange: (v: string) => void;
  onSaveOpening: () => void;
  savingOpening: boolean;
  showOverrideConfirm: boolean;
  onOverrideConfirm: () => void;
  onOverrideCancel: () => void;
}) {
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const rows: { label: string; value: number; highlight?: boolean;
                indent?: boolean; positive?: boolean }[] =
    report
      ? [
          { label: 'Opening Stock Value', value: report.openingStockValue },
          { label: '+ Total Purchases', value: report.totalPurchases, indent: true },
          { label: 'Total Cost Available', value: report.totalCostAvailable, highlight: true },
          { label: '− Closing Stock Value', value: report.closingStockValue, indent: true },
          { label: 'Cost of Goods Sold', value: report.costOfGoodsSold, highlight: true },
          { label: 'Total Sales', value: report.totalSales },
          { label: '− Cost of Goods Sold', value: report.costOfGoodsSold, indent: true },
          { label: 'Gross Profit', value: report.grossProfit, highlight: true, positive: report.grossProfit >= 0 },
          { label: '− Total Expenses', value: report.totalExpenses, indent: true },
          { label: 'Net Profit', value: report.netProfit, highlight: true, positive: report.netProfit >= 0 },
        ]
      : [];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="pl-3 pr-8 py-2 rounded-lg border border-border bg-background
                       text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {MONTHS_LABELS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Year</label>
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="pl-3 pr-8 py-2 rounded-lg border border-border bg-background
                       text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          {(() => {
            const dayOfMonth = new Date().getDate();
            const isLocked = dayOfMonth > 7;
            return (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Opening Stock Value (₦)
                  </label>
                  {isLocked && (
                    <span className="flex items-center gap-1 px-2 py-0.5
                                     rounded text-[10px] font-medium
                                     bg-amber-500/10 text-amber-700
                                     border border-amber-500/20">
                      <Lock size={10} />
                      Locked — editable days 1–7 only
                    </span>
                  )}
                </div>
                <NumericInput
                  value={openingInput}
                  onChange={onOpeningChange}
                  decimals={false}
                  placeholder="e.g. 4,000,000"
                  className="w-44 px-3 py-2 rounded-lg border border-border
                             bg-background text-sm focus:outline-none
                             focus:ring-2 focus:ring-primary/30"
                />
              </div>
            );
          })()}
          <button
            onClick={() => onSaveOpening()}
            disabled={savingOpening}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground
                       text-sm font-medium hover:bg-primary/90
                       disabled:opacity-60 transition-colors"
          >
            {savingOpening ? 'Saving...' : 'Set'}
          </button>
        </div>
      </div>

      {/* P&L Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : !report ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Select a month and year to view the report
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold">
              {MONTHS_LABELS[month - 1]} {year} — Profit & Loss
            </h3>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-3 ${row.highlight ? 'bg-muted/40' : ''}`}
              >
                <span className={`text-sm ${row.indent ? 'pl-4 text-muted-foreground' : row.highlight ? 'font-semibold' : 'font-medium'}`}>
                  {row.label}
                </span>
                <span className={`text-sm font-semibold ${
                  row.highlight && row.positive !== undefined
                    ? row.positive ? 'text-emerald-600' : 'text-red-500'
                    : 'text-foreground'
                }`}>
                  {row.value < 0 ? '-' : ''}{fmtNGN(Math.abs(row.value))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOverrideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onOverrideCancel}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <Lock size={20} className="text-amber-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Override locked record?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Opening stock is locked after day 7. This override will
              be recorded in the activity log. Are you sure you want
              to proceed?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onOverrideCancel}
                className="flex-1 px-4 py-2.5 text-sm font-medium
                           text-gray-700 bg-gray-100 rounded-lg
                           hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onOverrideConfirm}
                className="flex-1 px-4 py-2.5 text-sm font-medium
                           text-white bg-amber-500 rounded-lg
                           hover:bg-amber-600 transition-colors"
              >
                Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
