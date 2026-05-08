import api from '@/lib/api';
import {
  Expense,
  ExpenseCategory,
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  ExpenseSummary,
  SuccessResponse,
  PaginatedResponse,
} from '@/types';

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: number;
}

type MaybeWrapped<T> = SuccessResponse<T> | T;

function unwrapPaginated<T>(payload: MaybeWrapped<PaginatedResponse<T>>): PaginatedResponse<T> {
  if (payload && 'success' in payload && 'data' in payload) {
    return (payload as SuccessResponse<PaginatedResponse<T>>).data;
  }
  return payload as PaginatedResponse<T>;
}

function unwrap<T>(payload: MaybeWrapped<T>): T {
  if (payload !== null && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as SuccessResponse<T>).data;
  }
  return payload as T;
}

function coerceExpense(e: Expense): Expense {
  return { ...e, amount: Number(e.amount) };
}

export const expensesService = {
  // ── Categories ──────────────────────────────────────────
  getCategories: async () => {
    const response = await api.get<MaybeWrapped<ExpenseCategory[]>>('/expense-categories');
    return unwrap(response.data);
  },

  createCategory: async (data: CreateExpenseCategoryDto) => {
    const response = await api.post<SuccessResponse<ExpenseCategory>>('/expense-categories', data);
    return response.data;
  },

  updateCategory: async (id: number, data: UpdateExpenseCategoryDto) => {
    const response = await api.patch<SuccessResponse<ExpenseCategory>>(`/expense-categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: number) => {
    const response = await api.delete<SuccessResponse<void>>(`/expense-categories/${id}`);
    return response.data;
  },

  // ── Expenses ────────────────────────────────────────────
  getAll: async (filters: ExpenseFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await api.get<any>(`/expenses?${params.toString()}`);
    const raw = response.data;

    // Unwrap { success, data: payload } envelope if present
    const payload = (raw?.success !== undefined && raw?.data !== undefined) ? raw.data : raw;

    // Support both { data: [], meta: {} } and { items: [], total, page, ... }
    const items: Expense[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];

    const meta = payload?.meta ?? {
      total: payload?.total ?? items.length,
      page: payload?.page ?? 1,
      limit: payload?.limit ?? filters.limit ?? 15,
      totalPages: payload?.totalPages ?? 1,
    };

    return { data: items.map(coerceExpense), meta };
  },

  create: async (data: CreateExpenseDto) => {
    const response = await api.post<SuccessResponse<Expense>>('/expenses', data);
    return response.data;
  },

  update: async (id: string, data: UpdateExpenseDto) => {
    const response = await api.patch<SuccessResponse<Expense>>(`/expenses/${id}`, data);
    return response.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<SuccessResponse<void>>(`/expenses/${id}`);
    return response.data;
  },

  getSummary: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const response = await api.get<MaybeWrapped<ExpenseSummary>>(
      `/expenses/summary?${params.toString()}`
    );
    return unwrap(response.data);
  },
};
