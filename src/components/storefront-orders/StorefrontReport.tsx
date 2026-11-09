'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMediaQuery } from '@/components/storefront/useMediaQuery';
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

const input = 'block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20 md:text-sm';
const GREEN = '#1a7a4a';
const RED = '#dc2626';

const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

function Card({ title, children, aside, className = '' }: { title: string; children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Tone = 'green' | 'red' | 'amber' | 'neutral';
const TONE_VALUE: Record<Tone, string> = { green: 'text-[#14693f]', red: 'text-red-700', amber: 'text-amber-700', neutral: 'text-gray-900' };
const TONE_EDGE: Record<Tone, string> = { green: '', red: 'border-l-4 border-l-red-500', amber: 'border-l-4 border-l-amber-500', neutral: '' };

/** One summary figure: a plain bordered tile (no pattern, glow or lift). Long values wrap instead of widening the grid. */
function Metric({ label, value, sub, tone = 'neutral', strong = false }: { label: string; value: string; sub: string; tone?: Tone; strong?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 sm:p-4 ${strong ? 'border-[#b9e0c9] bg-[#f3faf5]' : 'border-gray-200 bg-white'} ${TONE_EDGE[tone]}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`mt-1 font-bold leading-tight [overflow-wrap:anywhere] ${strong ? 'text-[26px] sm:text-[28px]' : 'text-xl sm:text-2xl'} ${TONE_VALUE[tone]}`}>{value}</p>
      <p className="mt-1 text-sm text-gray-600">{sub}</p>
    </div>
  );
}

const GRID = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4';

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

  const phone = useMediaQuery('(max-width: 639px)');
  const periodButton = (active: boolean) =>
    `inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors ${active ? 'border-[#1a7a4a] bg-[#1a7a4a] text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;
  const label = 'mb-1 block text-sm font-medium text-gray-700';

  return (
    <div className="mx-auto w-full max-w-[80rem]">
      <div className="mb-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#0f4f2d] md:text-[32px]">Online store reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Money collected through Flutterwave, from the verified payment records. This is separate from in-store sales, profit and loss, and inventory, and is not included in them.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div role="group" aria-label="Report period" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {REPORT_RANGE_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={range === o.value} onClick={() => choose(o.value)} className={periodButton(range === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
            <div><label htmlFor="rep-from" className={label}>From (Lagos)</label><input id="rep-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={input} /></div>
            <div><label htmlFor="rep-to" className={label}>To (Lagos)</label><input id="rep-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={input} /></div>
            <button type="button" onClick={applyCustom} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1a7a4a] px-5 text-sm font-medium text-white hover:bg-[#145c37] sm:col-span-1">Apply</button>
          </div>
        )}
        <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 sm:ml-auto">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>
      {rangeError && <p role="alert" className="mb-4 text-sm text-red-600">{rangeError}</p>}

      {error ? (
        <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-8">
          <AlertCircle size={28} className="mx-auto mb-3 text-red-400" />
          <p className="text-base font-medium text-gray-800">Could not load the report</p>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#b9e0c9] px-4 text-sm font-medium text-[#1a7a4a] hover:bg-[#e8f5ee]"><RefreshCw size={14} /> Try again</button>
        </div>
      ) : !report || !s ? (
        <div role="status" aria-busy="true">
          <div className={GRID}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />)}
          </div>
          <div className="mt-5 h-60 animate-pulse rounded-2xl bg-gray-200 md:h-[300px]" />
        </div>
      ) : (
        <div className={isLoading ? 'opacity-60 transition-opacity' : ''} aria-busy={isLoading}>
          <p className="mb-4 text-sm text-gray-600" data-testid="report-period">
            {report.period.from === report.period.to ? report.period.from : `${report.period.from} to ${report.period.to}`} · Africa/Lagos · amounts in Nigerian Naira
          </p>

          <div className={GRID}>
            <Metric label="Gross collections" value={formatNaira(s.grossCollections)} sub={`${s.capturedPayments} verified payment${s.capturedPayments === 1 ? '' : 's'}`} tone="green" />
            <Metric label="Total refunds" value={formatNaira(s.refunds)} sub={`${s.refundedPayments} refund${s.refundedPayments === 1 ? '' : 's'} recorded`} tone="red" />
            <Metric label="Net collections" value={formatNaira(s.netCollections)} sub="Gross minus refunds" tone="green" strong />
            <Metric label="Needs review" value={String(s.needsReview.count)} sub={`${formatNaira(s.needsReview.amount)} awaiting a decision`} tone="amber" />
            <Metric label="Pending payments" value={String(s.pendingPayments.count)} sub={`${formatNaira(s.pendingPayments.amount)} not collected`} />
            <Metric label="Failed payments" value={String(s.failedPayments.count)} sub={`${formatNaira(s.failedPayments.amount)} not collected`} />
            <Metric label="Duplicate charges" value={String(s.duplicateCharges.count)} sub={`${formatNaira(s.duplicateCharges.amount)} (inside gross)`} />
            <Metric label="Paid / completed orders" value={`${s.paidOrders} / ${s.completedOrders}`} sub={`${s.cancelledOrders} cancelled · ${s.expiredOrders} expired`} tone="green" />
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card title="Collections and refunds">
              {!hasActivity && <p className="mb-3 text-sm text-gray-600" data-testid="no-activity">No payments were collected or refunded in this period.</p>}
              <div className="h-60 w-full md:h-[300px]" role="img" aria-label="Daily collections, refunds and net collections">
                <ResponsiveContainer>
                  <ComposedChart data={report.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 12 }} minTickGap={12} />
                    <YAxis tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 12 }} width={44} />
                    <Tooltip formatter={(v) => formatNaira(Number(v))} labelFormatter={(l) => String(l)} contentStyle={{ fontSize: 14 }} />
                    <Legend wrapperStyle={{ fontSize: 14, paddingTop: 4 }} iconSize={10} />
                    <Bar dataKey="gross" name="Collections" fill={GREEN} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="refunds" name="Refunds" fill={RED} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#0f4f2d" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Payment status">
              {report.paymentsByStatus.length === 0 ? (
                <p className="text-sm text-gray-600">No payment attempts in this period.</p>
              ) : (
                <ul className="space-y-3">
                  {report.paymentsByStatus.map((p) => (
                    <li key={p.status} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-800">{PAYMENT_RECORD_LABEL[p.status] ?? p.status}</span>
                      <span className="text-right"><span className="font-semibold">{p.count}</span><span className="block text-sm text-gray-600">{formatNaira(p.amount)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm text-gray-600">Attempts created in the period. Only verified, captured payments count as collections.</p>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card title="Recent successful transactions">
              {report.recentSuccessful.length === 0 ? (
                <p className="text-sm text-gray-600">No successful payments in this period.</p>
              ) : phone ? (
                <ul className="divide-y divide-gray-100">
                  {report.recentSuccessful.map((t, i) => (
                    <li key={`${t.orderNumber}-${i}`} className="py-1">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/storefront-orders/${encodeURIComponent(t.orderNumber)}`} className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-[#0f4f2d] hover:underline">{t.orderNumber}</Link>
                        <span className="shrink-0 text-sm font-semibold text-gray-900">{formatNaira(t.amount)}</span>
                      </div>
                      <p className="-mt-1 pb-2 text-sm text-gray-600">
                        {formatLagosDateTime(t.capturedAt)}
                        {t.reconciliation && <span className="ml-2 text-red-600">{RECONCILIATION_LABEL[t.reconciliation] ?? t.reconciliation}</span>}
                        {t.status === 'refunded' && <span className="ml-2 text-purple-600">refunded</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600"><th scope="col" className="py-2 font-semibold">Order</th><th scope="col" className="px-4 py-2 font-semibold">Captured</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr></thead>
                    <tbody>
                      {report.recentSuccessful.map((t, i) => (
                        <tr key={`${t.orderNumber}-${i}`} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-2.5 align-middle">
                            <Link href={`/storefront-orders/${encodeURIComponent(t.orderNumber)}`} className="inline-flex min-h-11 items-center font-medium text-[#0f4f2d] hover:underline">{t.orderNumber}</Link>
                            {t.reconciliation && <span className="ml-2 text-sm text-red-600">{RECONCILIATION_LABEL[t.reconciliation] ?? t.reconciliation}</span>}
                            {t.status === 'refunded' && <span className="ml-2 text-sm text-purple-600">refunded</span>}
                          </td>
                          <td className="px-4 py-2.5 align-middle text-gray-700">{formatLagosDateTime(t.capturedAt)}</td>
                          <td className="whitespace-nowrap py-2.5 text-right align-middle font-medium">{formatNaira(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Reconciliation warnings" aside={s.needsReview.count > 0 ? <span className="shrink-0 text-sm font-medium text-red-600">{s.needsReview.count} open</span> : undefined}>
              {report.reconciliationWarnings.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-700"><CheckCircle2 size={18} className="shrink-0 text-[#1a7a4a]" aria-hidden="true" /> Nothing needs an administrator’s decision.</p>
              ) : (
                <ul className="space-y-3">
                  {report.reconciliationWarnings.map((w) => (
                    <li key={w.orderNumber} className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <Link href={`/storefront-orders/${encodeURIComponent(w.orderNumber)}`} className="inline-flex min-h-11 items-center break-all font-semibold text-[#0f4f2d] hover:underline">{w.orderNumber}</Link>
                        <span className="text-sm font-medium text-red-700">{REVIEW_REASON_LABEL[w.reason as ReviewReason] ?? w.reason}</span>
                      </div>
                      <p className="text-sm text-gray-700">Order total {formatNaira(w.orderTotal)} · collected {formatNaira(w.collected)} · since {formatLagosDateTime(w.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm text-gray-600">Open items stay here whichever period is shown.</p>
            </Card>
          </div>

          <details className="mt-5 text-sm text-gray-700">
            <summary className="flex min-h-11 cursor-pointer items-center">How these numbers are worked out</summary>
            <dl className="mt-2 space-y-2 text-sm">
              {Object.entries(report.definitions).map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-24 shrink-0 font-medium capitalize">{k}</dt><dd className="min-w-0">{v}</dd></div>)}
            </dl>
          </details>
        </div>
      )}
    </div>
  );
}
