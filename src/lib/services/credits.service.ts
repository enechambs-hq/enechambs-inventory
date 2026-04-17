import api from '@/lib/api';
import { Credit, CreateCreditDto, CreditStatus, PaginatedResponse } from '@/types';

export interface CreditFilters {
  page?: number;
  limit?: number;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  status?: CreditStatus | '';
}

export const creditsService = {
  getAll: async (filters: CreditFilters = {}): Promise<PaginatedResponse<Credit>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await api.get<PaginatedResponse<Credit>>(`/credits?${params}`);
    return response.data;
  },

  getMyCredits: async (filters: CreditFilters = {}): Promise<PaginatedResponse<Credit>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await api.get<PaginatedResponse<Credit>>(`/credits/my-credits?${params}`);
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

  updateStatus: async (id: string, status: string, voidReason?: string): Promise<Credit> => {
    const response = await api.patch<Credit>(`/credits/${id}/status`, {
      status,
      ...(voidReason ? { voidReason } : {}),
    });
    return response.data;
  },

  recordPayment: async (id: string, amount: number, note?: string): Promise<Credit> => {
    const response = await api.patch<Credit>(`/credits/${id}/payment`, {
      amount,
      ...(note ? { note } : {}),
    });
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
