import api from '@/lib/api';
import { Category, SuccessResponse } from '@/types';

export const categoriesService = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get<SuccessResponse<Category[]> | Category[]>('/categories');
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },
};
