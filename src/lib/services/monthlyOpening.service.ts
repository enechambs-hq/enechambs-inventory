import api from '@/lib/api';

export const monthlyOpeningService = {
  set: async (month: number, year: number, value: number) => {
    const res = await api.post('/monthly-opening', {
      month, year, openingStockValue: value,
    });
    return res.data;
  },

  get: async (month: number, year: number): Promise<number> => {
    const res = await api.get<number>(
      `/monthly-opening/${year}/${month}`,
    );
    return res.data ?? 0;
  },
};
