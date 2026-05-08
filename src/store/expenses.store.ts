import { create } from 'zustand';
import { Expense } from '@/types';

interface ExpensesState {
  expenses: Expense[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setExpenses: (expenses: Expense[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useExpensesStore = create<ExpensesState>((set) => ({
  expenses: [],
  total: 0,
  page: 1,
  limit: 15,
  totalPages: 1,
  isLoading: false,
  setExpenses: (expenses, meta) => set({ expenses, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));
