'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, startOfMonth, startOfYear } from 'date-fns';
import {
  Plus, ChevronLeft, ChevronRight, X, TrendingDown,
  Pencil, Trash2, Settings2, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NumericInput } from '@/components/shared/NumericInput';
import { expensesService } from '@/lib/services/expenses.service';
import {
  Expense, ExpenseCategory, ExpenseSummary, UserRole, ExpenseCategoryType,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { useExpensesStore } from '@/store/expenses.store';
import { StatCard } from '@/components/shared/StatCard';

// ── helpers ──────────────────────────────────────────────

const TODAY = format(new Date(), 'yyyy-MM-dd');
const MONTH_START = format(startOfMonth(new Date()), 'yyyy-MM-dd');
const YEAR_START = format(startOfYear(new Date()), 'yyyy-MM-dd');

const TYPE_LABEL: Record<ExpenseCategoryType, string> = {
  overhead: 'Overhead',
  operational: 'Operational',
  other: 'Other',
};

const TYPE_CLS: Record<ExpenseCategoryType, string> = {
  overhead: 'bg-amber-500/10 text-amber-600',
  operational: 'bg-blue-500/10 text-blue-600',
  other: 'bg-muted text-muted-foreground',
};

// ── Expense Form schema ───────────────────────────────────

const expenseSchema = z.object({
  date: z.string().min(1, 'Required'),
  categoryId: z.coerce.number().min(1, 'Select a category'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Must be greater than 0'),
  paidTo: z.string().min(1, 'Required'),
});
type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseFormOutput = z.output<typeof expenseSchema>;

// ── Category Form schema ──────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.enum(['overhead', 'operational', 'other']),
  description: z.string().optional(),
  isActive: z.boolean(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

// ── ExpenseFormModal ──────────────────────────────────────

function ExpenseFormModal({
  mode,
  expense,
  categories,
  isLoading,
  onClose,
  onSave,
}: {
  mode: 'add' | 'edit';
  expense: Expense | null;
  categories: ExpenseCategory[];
  isLoading: boolean;
  onClose: () => void;
  onSave: (data: ExpenseFormOutput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ExpenseFormInput, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: expense
      ? {
          date: expense.date.slice(0, 10),
          categoryId: expense.categoryId,
          description: expense.description ?? '',
          amount: expense.amount,
          paidTo: expense.paidTo,
        }
      : { date: TODAY, categoryId: 0, description: '', amount: 0, paidTo: '' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { field: amountField } = useController({ control: control as any, name: 'amount' });

  const inputCls =
    'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-card rounded-2xl border border-border p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {isLoading && (
          <div className="absolute inset-0 bg-card/85 rounded-2xl flex items-center justify-center z-10 gap-3">
            <div className="h-5 w-5 rounded-full border-[2.5px] border-primary border-t-transparent animate-spin" />
            <span className="text-sm font-semibold">Saving…</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[17px] font-bold">
              {mode === 'add' ? 'Record Expense' : 'Edit Expense'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'add' ? 'Add a new expense entry' : 'Update expense details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <input {...register('date')} type="date" className={inputCls} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount (₦)</label>
              <NumericInput
                value={amountField.value}
                onChange={(v) => amountField.onChange(v)}
                onBlur={amountField.onBlur}
                name={amountField.name}
                decimals={true}
                className={inputCls}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Category</label>
            <select {...register('categoryId')} className={inputCls}>
              <option value={0}>Select category…</option>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {errors.categoryId && (
              <p className="text-xs text-destructive">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Paid To</label>
            <input
              {...register('paidTo')}
              type="text"
              placeholder="Vendor, utility company, landlord…"
              className={inputCls}
            />
            {errors.paidTo && <p className="text-xs text-destructive">{errors.paidTo.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Description{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Additional notes…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {mode === 'add' ? 'Save Expense' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CategoryManageModal ───────────────────────────────────

function CategoryManageModal({
  categories,
  onClose,
  onRefresh,
}: {
  categories: ExpenseCategory[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'other', description: '', isActive: true },
  });

  const openAdd = () => {
    setEditTarget(null);
    reset({ name: '', type: 'other', description: '', isActive: true });
    setShowForm(true);
  };

  const openEdit = (cat: ExpenseCategory) => {
    setEditTarget(cat);
    reset({
      name: cat.name,
      type: cat.type,
      description: cat.description ?? '',
      isActive: cat.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async (data: CategoryFormValues) => {
    setSaving(true);
    try {
      if (editTarget) {
        await expensesService.updateCategory(editTarget.id, {
          name: data.name.trim(),
          type: data.type,
          description: data.description?.trim() || undefined,
          isActive: data.isActive,
        });
        toast.success('Category updated');
      } else {
        await expensesService.createCategory({
          name: data.name.trim(),
          type: data.type,
          description: data.description?.trim() || undefined,
        });
        toast.success('Category added');
      }
      setShowForm(false);
      onRefresh();
    } catch {
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: ExpenseCategory) => {
    try {
      await expensesService.deleteCategory(cat.id);
      toast.success('Category removed');
      onRefresh();
    } catch {
      toast.error('Failed to remove category');
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl border border-border p-7 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold">Manage Categories</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add, edit or remove expense categories
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inline form */}
        {showForm && (
          <form
            onSubmit={handleSubmit(handleSave)}
            className="mb-5 p-4 rounded-xl border border-border bg-muted/30 space-y-3"
          >
            <p className="text-sm font-semibold">
              {editTarget ? `Edit "${editTarget.name}"` : 'New Category'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <input {...register('name')} type="text" className={inputCls} />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Type</label>
                <select {...register('type')} className={inputCls}>
                  <option value="overhead">Overhead</option>
                  <option value="operational">Operational</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input {...register('description')} type="text" className={inputCls} />
            </div>
            {editTarget && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input {...register('isActive')} type="checkbox" className="rounded" />
                Active
              </label>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-md border text-xs hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editTarget ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        )}

        {/* Category list */}
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_CLS[cat.type]}`}
                >
                  {TYPE_LABEL[cat.type]}
                </span>
                <span className={`text-sm font-medium truncate ${!cat.isActive ? 'opacity-40' : ''}`}>
                  {cat.name}
                </span>
                {!cat.isActive && (
                  <span className="text-[10px] text-muted-foreground shrink-0">inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={openAdd}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Plus size={14} /> Add Category
        </button>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────

function DeleteConfirm({
  expense,
  onClose,
  onConfirm,
  isLoading,
}: {
  expense: Expense;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-500" />
        </div>
        <h2 className="text-[15px] font-bold">Delete expense?</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          ₦{expense.amount.toLocaleString()} · {expense.category.name} on{' '}
          {format(new Date(expense.date), 'MMM d, yyyy')}. This cannot be undone.
        </p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Monthly Spend Chart ───────────────────────────────────

function SpendChart({ byMonth }: { byMonth: { month: string; total: number }[] }) {
  const last12 = byMonth.slice(-12);
  const data = last12.map((m) => ({
    month: format(new Date(`${m.month}-01`), 'MMM yy'),
    Total: Number(m.total),
  }));
  const isEmpty = data.every((d) => d.Total === 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-[15px] font-bold">Monthly Spending</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Expense totals per month</p>
      </div>
      {isEmpty ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={(v) =>
                v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${(v / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(v) => [`₦${Number(v).toLocaleString()}`, 'Total']}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
            />
            <Bar dataKey="Total" fill="#e05a3a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────

export default function ExpensesPage() {
  const { expenses, total, page, limit, totalPages, isLoading, setExpenses, setLoading, setPage } =
    useExpensesStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<ExpenseSummary | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Modal state
  const [formModal, setFormModal] = useState<{ open: boolean; mode: 'add' | 'edit'; expense: Expense | null }>({
    open: false,
    mode: 'add',
    expense: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await expensesService.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await expensesService.getAll({
        page,
        limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
      });
      setExpenses(data.data, data.meta);
    } catch {
      // fail silently — empty state handles this
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate, categoryId, setLoading, setExpenses]);

  // Admin: fetch summary for stats + chart
  useEffect(() => {
    if (!isAdmin) return;
    // All-time for chart
    expensesService.getSummary().then(setSummary).catch(() => {});
    // Current month for this-month stats
    expensesService.getSummary(MONTH_START, TODAY).then(setMonthlySummary).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSaveExpense = async (data: ExpenseFormOutput) => {
    setSubmitting(true);
    try {
      if (formModal.mode === 'add') {
        await expensesService.create({
          date: data.date,
          categoryId: data.categoryId,
          description: data.description || undefined,
          amount: data.amount,
          paidTo: data.paidTo,
        });
        toast.success('Expense recorded');
      } else if (formModal.expense) {
        await expensesService.update(formModal.expense.id, {
          date: data.date,
          categoryId: data.categoryId,
          description: data.description || undefined,
          amount: data.amount,
          paidTo: data.paidTo,
        });
        toast.success('Expense updated');
      }
      setFormModal({ open: false, mode: 'add', expense: null });
      fetchExpenses();
      if (isAdmin) {
        expensesService.getSummary().then(setSummary).catch(() => {});
        expensesService.getSummary(MONTH_START, TODAY).then(setMonthlySummary).catch(() => {});
      }
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string | string[] } } }).response?.data
          ?.message || 'Something went wrong';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesService.remove(deleteTarget.id);
      toast.success('Expense deleted');
      setDeleteTarget(null);
      fetchExpenses();
      if (isAdmin) {
        expensesService.getSummary().then(setSummary).catch(() => {});
        expensesService.getSummary(MONTH_START, TODAY).then(setMonthlySummary).catch(() => {});
      }
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  const ytdTotal = summary?.byMonth
    .filter((m) => m.month.startsWith(new Date().getFullYear().toString()))
    .reduce((s, m) => s + Number(m.total), 0) ?? 0;

  const thisMonthTotal = monthlySummary?.totalAmount ?? 0;
  const thisMonthCount = monthlySummary?.byCategory.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage business expenditures</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Settings2 size={14} /> Categories
          </button>
          <button
            onClick={() => setFormModal({ open: true, mode: 'add', expense: null })}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            style={{ boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }}
          >
            <Plus size={15} /> Record Expense
          </button>
        </div>
      </div>

      {/* Stats — admin only */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="This Month"
              value={`₦${thisMonthTotal.toLocaleString()}`}
              sub={format(new Date(), 'MMMM yyyy')}
              icon={TrendingDown}
              accentColor="#e05a3a"
              iconBg="bg-red-500/10"
              iconColor="text-red-500"
            />
            <StatCard
              label="Year to Date"
              value={`₦${ytdTotal.toLocaleString()}`}
              sub={`Jan – ${format(new Date(), 'MMM yyyy')}`}
              icon={TrendingDown}
              accentColor="#b45309"
              iconBg="bg-amber-500/10"
              iconColor="text-amber-600"
            />
            <StatCard
              label="Entries This Month"
              value={thisMonthCount.toLocaleString()}
              sub="individual expense records"
              icon={Tag}
              accentColor="#0369a1"
              iconBg="bg-blue-500/10"
              iconColor="text-blue-600"
            />
          </div>
          {summary && summary.byMonth.length > 0 && (
            <SpendChart byMonth={summary.byMonth} />
          )}
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(startDate || endDate || categoryId) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setCategoryId(''); setPage(1); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 ml-auto">
          {[
            { label: 'This Month', start: MONTH_START, end: TODAY },
            { label: 'YTD', start: YEAR_START, end: TODAY },
          ].map(({ label, start, end }) => (
            <button
              key={label}
              onClick={() => { setStartDate(start); setEndDate(end); setPage(1); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                startDate === start && endDate === end
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                {['#', 'Date', 'Category', 'Description', 'Paid To', 'Amount', 'Recorded By', ''].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                        i === 0 ? 'rounded-tl-2xl' : i === 7 ? 'rounded-tr-2xl' : ''
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
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
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <TrendingDown size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No expenses found</p>
                    {(startDate || endDate || categoryId) && (
                      <p className="text-xs text-muted-foreground mt-1">Try clearing the filters</p>
                    )}
                  </td>
                </tr>
              ) : (
                expenses.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      {format(new Date(exp.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_CLS[exp.category.type]}`}
                        >
                          {exp.category.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground max-w-[180px] truncate">
                      {exp.description || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[13px] font-medium">{exp.paidTo}</td>
                    <td className="px-3 py-3 font-bold text-[14px] text-red-600">
                      ₦{exp.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">
                      {exp.recordedBy
                        ? `${exp.recordedBy.firstName} ${exp.recordedBy.lastName}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setFormModal({ open: true, mode: 'edit', expense: exp })}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(exp)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-semibold text-foreground">{expenses.length}</span> of{' '}
          <span className="font-semibold text-foreground">{total}</span> expenses
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
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
                      : 'border border-border hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {formModal.open && (
        <ExpenseFormModal
          mode={formModal.mode}
          expense={formModal.expense}
          categories={categories}
          isLoading={submitting}
          onClose={() => setFormModal({ open: false, mode: 'add', expense: null })}
          onSave={handleSaveExpense}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          expense={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isLoading={deleting}
        />
      )}

      {catModalOpen && (
        <CategoryManageModal
          categories={categories}
          onClose={() => setCatModalOpen(false)}
          onRefresh={fetchCategories}
        />
      )}
    </div>
  );
}
