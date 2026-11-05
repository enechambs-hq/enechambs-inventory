'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock, Copy, RefreshCw, RotateCcw, ShieldAlert, Wallet, XCircle } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/shared/StatCard';
import { describeApiError, explainProblem } from '@/lib/combos/errors';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';
import {
  customRangeError,
  formatLagosDateTime,
  formatNaira,
  lagosDateOf,
  PAYMENT_RECORD_LABEL,
  RECONCILIATION_LABEL,
  REPORT_RANGE_OPTIONS,
  REVIEW_REASON_LABEL,
} from '@/lib/storefront-orders/format';
import type { ReportRange, ReviewReason, StorefrontReport as Report } from '@/types/storefront-orders';

const field = 'px-3.5 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20';
const GREEN = '#1a7a4a';
const RED = '#dc2626';

const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function StorefrontReport() {
  const [range, setRange] = useState<ReportRange>('last7');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ range: ReportRange; from: string; to: string }>({ range: 'last7', from: '', to: '' });
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await storefrontOrdersService.report(applied);
      if (id !== requestId.current) return;
      setReport(result);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(explainProblem(describeApiError(err), 'load'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function choose(next: ReportRange) {
    setRange(next);
    setRangeError(null);
    if (next !== 'custom') setApplied({ range: next, from: '', to: '' });
    else if (!from && !to) {
      const today = lagosDateOf(new Date());
      setFrom(today);
      setTo(today);
    }
  }

  function applyCustom() {
    const problem = customRangeError(from, to);
    setRangeError(problem);
    if (!problem) setApplied({ range: 'custom', from, to });
  }

  const s = report?.summary;
  const hasActivity = !!report && (report.summary.capturedPayments > 0 || report.summary.refundedPayments > 0);

  return (
    <div className="min-h-screen bg-[#f0f2f0] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Online store reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Money collected through Flutterwave, from the verified payment records. This is separate from in-store sales, profit and loss, and inventory, and is not included in them.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Report period" className="flex flex-wrap gap-2">
          {REPORT_RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={range === o.value}
              onClick={() => choose(o.value)}
              className={`px-3.5 py-2 text-sm rounded-lg border transition-colors ${range === o.value ? 'bg-[#1a7a4a] text-white border-[#1a7a4a]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-end gap-2">
            <div><label htmlFor="rep-from" className="block text-[11px] text-gray-400">From (Lagos)</label><input id="rep-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={field} /></div>
            <div><label htmlFor="rep-to" className="block text-[11px] text-gray-400">To (Lagos)</label><input id="rep-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field} /></div>
            <button type="button" onClick={applyCustom} className="px-4 py-2 text-sm font-medium bg-[#1a7a4a] text-white rounded-lg hover:bg-[#145c37]">Apply</button>
          </div>
        )}
        <button type="button" onClick={() => void load()} aria-label="Reload report" className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>
      {rangeError && <p role="alert" className="mb-4 text-sm text-red-600">{rangeError}</p>}

      {error ? (
        <div role="alert" className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-800">Could not load the report</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee]"><RefreshCw size={14} /> Try again</button>
        </div>
      ) : !report || !s ? (
        <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : (
        <div className={isLoading ? 'opacity-60 transition-opacity' : ''} aria-busy={isLoading}>
          <p className="mb-4 text-xs text-gray-500" data-testid="report-period">
            {report.period.from === report.period.to ? report.period.from : `${report.period.from} to ${report.period.to}`} · Africa/Lagos · amounts in Nigerian Naira
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gross collections" value={formatNaira(s.grossCollections)} sub={`${s.capturedPayments} verified payment${s.capturedPayments === 1 ? '' : 's'}`} icon={ArrowDownToLine} accentColor="#1a7a4a" iconBg="bg-[#e8f5ee]" iconColor="text-[#1a7a4a]" />
            <StatCard label="Total refunds" value={formatNaira(s.refunds)} sub={`${s.refundedPayments} refund${s.refundedPayments === 1 ? '' : 's'} recorded`} icon={RotateCcw} accentColor="#dc2626" iconBg="bg-red-50" iconColor="text-red-600" />
            <StatCard label="Net collections" value={formatNaira(s.netCollections)} sub="Gross minus refunds" icon={Wallet} accentColor="#0f4f2d" iconBg="bg-[#e8f5ee]" iconColor="text-[#0f4f2d]" />
            <StatCard label="Needs review" value={String(s.needsReview.count)} sub={`${formatNaira(s.needsReview.amount)} awaiting a decision`} icon={ShieldAlert} accentColor="#b45309" iconBg="bg-amber-50" iconColor="text-amber-700" />
            <StatCard label="Pending payments" value={String(s.pendingPayments.count)} sub={`${formatNaira(s.pendingPayments.amount)} not collected`} icon={Clock} accentColor="#2563eb" iconBg="bg-blue-50" iconColor="text-blue-700" />
            <StatCard label="Failed payments" value={String(s.failedPayments.count)} sub={`${formatNaira(s.failedPayments.amount)} not collected`} icon={XCircle} accentColor="#6b7280" iconBg="bg-gray-100" iconColor="text-gray-600" />
            <StatCard label="Duplicate charges" value={String(s.duplicateCharges.count)} sub={`${formatNaira(s.duplicateCharges.amount)} (inside gross)`} icon={Copy} accentColor="#7c3aed" iconBg="bg-purple-50" iconColor="text-purple-700" />
            <StatCard label="Paid / completed orders" value={`${s.paidOrders} / ${s.completedOrders}`} sub={`${s.cancelledOrders} cancelled · ${s.expiredOrders} expired`} icon={CheckCircle2} accentColor="#1a7a4a" iconBg="bg-[#e8f5ee]" iconColor="text-[#1a7a4a]" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card title="Collections and refunds">
                {!hasActivity && <p className="mb-3 text-sm text-gray-500" data-testid="no-activity">No payments were collected or refunded in this period.</p>}
                <div style={{ width: '100%', height: 280 }} role="img" aria-label="Daily collections, refunds and net collections">
                  <ResponsiveContainer>
                    <ComposedChart data={report.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11 }} width={44} />
                      <Tooltip formatter={(v) => formatNaira(Number(v))} labelFormatter={(l) => String(l)} />
                      <Legend />
                      <Bar dataKey="gross" name="Collections" fill={GREEN} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="refunds" name="Refunds" fill={RED} radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="net" name="Net" stroke="#0f4f2d" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card title="Payment status">
              {report.paymentsByStatus.length === 0 ? (
                <p className="text-sm text-gray-500">No payment attempts in this period.</p>
              ) : (
                <ul className="space-y-3">
                  {report.paymentsByStatus.map((p) => (
                    <li key={p.status} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{PAYMENT_RECORD_LABEL[p.status] ?? p.status}</span>
                      <span className="text-right"><span className="font-semibold">{p.count}</span><span className="block text-xs text-gray-400">{formatNaira(p.amount)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-gray-400">Attempts created in the period. Only verified, captured payments count as collections.</p>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Recent successful transactions">
              {report.recentSuccessful.length === 0 ? (
                <p className="text-sm text-gray-500">No successful payments in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100"><th scope="col" className="py-2 font-semibold">Order</th><th scope="col" className="py-2 px-4 font-semibold">Captured</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr></thead>
                    <tbody>
                      {report.recentSuccessful.map((t, i) => (
                        <tr key={`${t.orderNumber}-${i}`} className="border-b border-gray-50">
                          <td className="py-2"><Link href={`/storefront-orders/${encodeURIComponent(t.orderNumber)}`} className="font-medium text-gray-900 hover:text-[#1a7a4a] hover:underline">{t.orderNumber}</Link>
                            {t.reconciliation && <span className="ml-2 text-[11px] text-red-600">{RECONCILIATION_LABEL[t.reconciliation] ?? t.reconciliation}</span>}
                            {t.status === 'refunded' && <span className="ml-2 text-[11px] text-purple-600">refunded</span>}</td>
                          <td className="py-2 px-4 text-gray-600 whitespace-nowrap">{formatLagosDateTime(t.capturedAt)}</td>
                          <td className="py-2 text-right font-medium whitespace-nowrap">{formatNaira(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Reconciliation warnings" aside={s.needsReview.count > 0 ? <span className="text-xs font-medium text-red-600">{s.needsReview.count} open</span> : undefined}>
              {report.reconciliationWarnings.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 size={16} className="text-[#1a7a4a]" aria-hidden="true" /> Nothing needs an administrator’s decision.</p>
              ) : (
                <ul className="space-y-3">
                  {report.reconciliationWarnings.map((w) => (
                    <li key={w.orderNumber} className="rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/storefront-orders/${encodeURIComponent(w.orderNumber)}`} className="font-semibold text-gray-900 hover:underline">{w.orderNumber}</Link>
                        <span className="text-xs font-medium text-red-700">{REVIEW_REASON_LABEL[w.reason as ReviewReason] ?? w.reason}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">Order total {formatNaira(w.orderTotal)} · collected {formatNaira(w.collected)} · since {formatLagosDateTime(w.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-gray-400">Open items stay here whichever period is shown.</p>
            </Card>
          </div>

          <details className="mt-6 text-sm text-gray-500">
            <summary className="cursor-pointer">How these numbers are worked out</summary>
            <dl className="mt-2 space-y-1 text-xs">
              {Object.entries(report.definitions).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-20 font-medium capitalize">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </details>
        </div>
      )}
    </div>
  );
}
