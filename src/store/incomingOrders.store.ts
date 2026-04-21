import { create } from 'zustand';
import { IncomingOrder } from '@/types';

interface IncomingOrdersState {
  orders: IncomingOrder[];
  myOrders: IncomingOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setOrders: (orders: IncomingOrder[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setMyOrders: (orders: IncomingOrder[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useIncomingOrdersStore = create<IncomingOrdersState>((set) => ({
  orders: [],
  myOrders: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  setOrders: (orders, meta) => set({ orders, ...meta }),
  setMyOrders: (myOrders, meta) => set({ myOrders, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));
