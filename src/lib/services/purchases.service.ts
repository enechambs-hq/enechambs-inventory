import api from '@/lib/api';
import { Purchase, CreatePurchaseDto } from '@/types';

export const purchasesService = {
  create: async (dto: CreatePurchaseDto): Promise<Purchase> => {
    const res = await api.post<Purchase>('/purchases', dto);
    return res.data;
  },

  findAll: async (month?: number, year?: number): Promise<Purchase[]> => {
    const params = new URLSearchParams();
    if (month) params.append('month', String(month));
    if (year) params.append('year', String(year));
    const res = await api.get<Purchase[]>(
      `/purchases${params.toString() ? '?' + params.toString() : ''}`,
    );
    return res.data;
  },

  getMonthlyTotal: async (month: number, year: number): Promise<number> => {
    const res = await api.get<number>(
      `/purchases/monthly-total?month=${month}&year=${year}`,
    );
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/purchases/${id}`);
  },
};
