'use client';

import { useEffect, useState, useCallback } from 'react';
import { PackagePlus, Trash2, Plus, X, ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { UserRole } from '@/types';
import { purchasesService } from '@/lib/services/purchases.service';
import type { Purchase } from '@/types';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const schema = z.object({
  productName: z.string().min(1, 'Required'),
  supplierName: z.string().optional(),
  quantityDescription: z.string().optional(),
  totalCost: z.coerce.number().min(1, 'Must be greater than 0'),
  purchaseDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function fmtNGN(n: number) {
  return '₦' + Math.round(n).toLocaleString('en-NG');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function PurchasesPage() {
  useAuthGuard(UserRole.ADMIN);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, total] = await Promise.all([
        purchasesService.findAll(filterMonth, filterYear),
        purchasesService.getMonthlyTotal(filterMonth, filterYear),
      ]);
      setPurchases(list);
      setMonthlyTotal(Number(total));
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => { load(); }, [load]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await purchasesService.create(data);
      toast.success('Purchase recorded');
      reset();
      setFormOpen(false);
      load();
    } catch {
      toast.error('Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await purchasesService.remove(id);
      toast.success('Purchase deleted');
      load();
    } catch {
      toast.error('Failed to delete purchase');
    } finally {
      setDeletingId(null);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-border bg-background ' +
    'text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ' +
    'focus:border-primary transition-all';
  const labelClass = 'block text-sm font-medium text-foreground mb-1';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Purchases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record bulk stock purchases
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary
                     text-primary-foreground text-sm font-medium
                     hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          Record Purchase
        </button>
      </div>

      {/* Filters + total */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border
                       bg-background text-sm focus:outline-none focus:ring-2
                       focus:ring-primary/30 cursor-pointer"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2
            -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border
                       bg-background text-sm focus:outline-none focus:ring-2
                       focus:ring-primary/30 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2
            -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="ml-auto px-4 py-2 rounded-lg bg-primary/8
                        border border-primary/20 text-sm">
          <span className="text-muted-foreground">Monthly Total: </span>
          <span className="font-bold text-primary">{fmtNGN(monthlyTotal)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <PackagePlus size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No purchases recorded for this period
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium
                               text-muted-foreground uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium
                               text-muted-foreground uppercase tracking-wide">
                  Supplier
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium
                               text-muted-foreground uppercase tracking-wide">
                  Qty Description
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium
                               text-muted-foreground uppercase tracking-wide">
                  Total Cost
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium
                               text-muted-foreground uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-border last:border-0 ${
                    i % 2 === 0 ? '' : 'bg-muted/20'
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{p.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.supplierName || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.quantityDescription || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {fmtNGN(p.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(p.purchaseDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-1.5 rounded-lg text-muted-foreground
                                 hover:bg-red-500/10 hover:text-red-500
                                 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Purchase Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setFormOpen(false); reset(); }}
          />
          <div className="relative w-full max-w-md bg-card rounded-2xl
                          shadow-xl border border-border p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold">Record Purchase</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add a bulk stock purchase
                </p>
              </div>
              <button
                onClick={() => { setFormOpen(false); reset(); }}
                className="p-1.5 rounded-lg text-muted-foreground
                           hover:bg-muted transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Product Name *</label>
                  <input
                    {...register('productName')}
                    placeholder="e.g. Honey Beans"
                    className={inputClass}
                  />
                  {errors.productName && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.productName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Supplier</label>
                  <input
                    {...register('supplierName')}
                    placeholder="Supplier name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Qty Description</label>
                  <input
                    {...register('quantityDescription')}
                    placeholder="e.g. 1 bag (50kg)"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Total Cost (₦) *</label>
                  <input
                    {...register('totalCost')}
                    type="number"
                    placeholder="0"
                    className={inputClass}
                  />
                  {errors.totalCost && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.totalCost.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Purchase Date *</label>
                  <input
                    {...register('purchaseDate')}
                    type="date"
                    className={inputClass}
                  />
                  {errors.purchaseDate && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.purchaseDate.message}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Notes</label>
                  <textarea
                    {...register('notes')}
                    placeholder="Optional notes"
                    rows={2}
                    className={inputClass + ' resize-none'}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); reset(); }}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium
                             hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground
                             text-sm font-semibold hover:bg-primary/90
                             disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
