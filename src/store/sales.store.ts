import { create } from 'zustand';
import { SaleTransaction } from '@/types';

interface SalesState {
  sales: SaleTransaction[];
  mySales: SaleTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setSales: (sales: SaleTransaction[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setMySales: (sales: SaleTransaction[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useSalesStore = create<SalesState>((set) => ({
  sales: [],
  mySales: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  setSales: (sales, meta) => set({ sales, ...meta }),
  setMySales: (mySales, meta) => set({ mySales, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));
