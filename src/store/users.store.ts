import { create } from 'zustand';
import { User } from '@/types';

interface UsersState {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  setUsers: (users: User[], meta: { total: number; page: number; limit: number; totalPages: number }) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: number) => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  setUsers: (users, meta) => set({ users, ...meta }),
  setLoading: (isLoading) => set({ isLoading }),
  setPage: (page) => set({ page }),
}));
