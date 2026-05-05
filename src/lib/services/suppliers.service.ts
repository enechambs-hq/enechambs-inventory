import api from '@/lib/api';
import { Supplier, SuccessResponse } from '@/types';

export const suppliersService = {
  getAll: async (): Promise<Supplier[]> => {
    const response = await api.get<SuccessResponse<Supplier[]> | Supplier[]>('/suppliers');
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },
};
