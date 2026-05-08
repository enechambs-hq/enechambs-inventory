import api from '@/lib/api';
import { Category, SuccessResponse } from '@/types';

interface CreateCategoryData {
  name: string;
  description?: string;
  isActive?: boolean;
}

interface UpdateCategoryData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export const categoriesService = {
  getAll: async (): Promise<Category[]> => {
    const response = await api.get<SuccessResponse<Category[]> | Category[]>('/categories');
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  create: async (data: CreateCategoryData): Promise<Category> => {
    const response = await api.post<SuccessResponse<Category> | Category>('/categories', data);
    const payload = response.data;
    return 'data' in payload && payload.data ? payload.data : (payload as Category);
  },

  update: async (id: number, data: UpdateCategoryData): Promise<Category> => {
    const response = await api.patch<SuccessResponse<Category> | Category>(`/categories/${id}`, data);
    const payload = response.data;
    return 'data' in payload && payload.data ? payload.data : (payload as Category);
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};