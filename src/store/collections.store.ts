import { create } from 'zustand';
import { Collection } from '@/types';

interface CollectionsState {
  collections: Collection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setCollections: (
    collections: Collection[],
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  ) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useCollectionsStore = create<CollectionsState>((set) => ({
  collections: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  setCollections: (collections, meta) => set({ collections, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));