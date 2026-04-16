import api from '@/lib/api';
import { Credit, CreateCreditDto, PaginatedResponse } from '@/types';

export const creditsService = {
  getAll: async (page = 1, limit = 20, search = ''): Promise<PaginatedResponse<Credit>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    const response = await api.get<PaginatedResponse<Credit>>(`/credits?${params}`);
    return response.data;
  },

  checkOverdue: async (): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/credits/check-overdue');
    return response.data;
  },

  getOverdue: async (): Promise<Credit[]> => {
    const response = await api.get<Credit[]>('/credits/overdue');
    return Array.isArray(response.data) ? response.data : [];
  },

  getMyCredits: async (page = 1, limit = 20): Promise<PaginatedResponse<Credit>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<Credit>>(`/credits/my-credits?${params}`);
    return response.data;
  },

  getById: async (id: string): Promise<Credit> => {
    const response = await api.get<Credit>(`/credits/${id}`);
    return response.data;
  },

  create: async (dto: CreateCreditDto): Promise<Credit> => {
    const response = await api.post<Credit>('/credits', dto);
    return response.data;
  },
};
