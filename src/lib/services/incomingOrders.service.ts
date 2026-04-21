import api from '@/lib/api';
import {
  IncomingOrder,
  CreateIncomingOrderDto,
  IncomingOrderStatus,
  IncomingOrderStats,
  PaginatedResponse,
  InventoryItem,
} from '@/types';

export interface IncomingOrderFilters {
  page?: number;
  limit?: number;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  status?: IncomingOrderStatus | '';
}

export const incomingOrdersService = {
  getAll: async (filters: IncomingOrderFilters = {}): Promise<PaginatedResponse<IncomingOrder>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await api.get<PaginatedResponse<IncomingOrder>>(`/incoming-orders?${params}`);
    return response.data;
  },

  getMyInquiries: async (filters: Pick<IncomingOrderFilters, 'page' | 'limit'> = {}): Promise<PaginatedResponse<IncomingOrder>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const response = await api.get<PaginatedResponse<IncomingOrder>>(`/incoming-orders/my-inquiries?${params}`);
    return response.data;
  },

  getStatistics: async (): Promise<IncomingOrderStats> => {
    const response = await api.get<IncomingOrderStats>('/incoming-orders/statistics');
    return response.data;
  },

  getById: async (id: string): Promise<IncomingOrder> => {
    const response = await api.get<IncomingOrder>(`/incoming-orders/${id}`);
    return response.data;
  },

  getSimilarItems: async (id: string): Promise<InventoryItem[]> => {
    const response = await api.get<InventoryItem[]>(`/incoming-orders/${id}/similar-items`);
    return Array.isArray(response.data) ? response.data : [];
  },

  updateStatus: async (id: string, status: IncomingOrderStatus): Promise<IncomingOrder> => {
    const response = await api.patch<IncomingOrder>(`/incoming-orders/${id}/status`, { status });
    return response.data;
  },

  create: async (dto: CreateIncomingOrderDto): Promise<IncomingOrder> => {
    const response = await api.post<IncomingOrder>('/incoming-orders', dto);
    return response.data;
  },
};
