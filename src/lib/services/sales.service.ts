import api from '@/lib/api';
import {
  Sale,
  CreateSaleDto,
  SuccessResponse,
  PaginatedResponse,
} from '@/types';

export interface SaleFilters {
  page?: number;
  limit?: number;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
}

type MaybeWrapped<T> = SuccessResponse<T> | T;

function unwrapPaginated<T>(payload: MaybeWrapped<PaginatedResponse<T>>): PaginatedResponse<T> {
  if (payload && 'success' in payload && 'data' in payload) {
    return (payload as SuccessResponse<PaginatedResponse<T>>).data;
  }
  return payload as PaginatedResponse<T>;
}

export const salesService = {
  getAll: async (filters: SaleFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await api.get<MaybeWrapped<PaginatedResponse<Sale>>>(
      `/sales?${params.toString()}`
    );
    return unwrapPaginated(response.data);
  },

  getMySales: async (filters: SaleFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await api.get<MaybeWrapped<PaginatedResponse<Sale>>>(
      `/sales/my-sales?${params.toString()}`
    );
    return unwrapPaginated(response.data);
  },

  getById: async (id: string) => {
    const response = await api.get<SuccessResponse<Sale>>(`/sales/${id}`);
    return response.data;
  },

  create: async (data: CreateSaleDto) => {
    const response = await api.post<SuccessResponse<Sale>>('/sales', data);
    return response.data;
  },

  getReceipt: async (id: string) => {
    const response = await api.get<string>(`/sales/receipt/${id}`, {
      responseType: 'text',
    });
    return response.data;
  },
};