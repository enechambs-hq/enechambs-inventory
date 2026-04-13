import { create } from 'zustand';
import { InventoryItem } from '@/types';

interface InventoryState {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setItems: (items: InventoryItem[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  setItems: (items, meta) => set({ items, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));