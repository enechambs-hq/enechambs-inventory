import api from '@/lib/api';
import {
  InventoryItem,
  CreateInventoryDto,
  UpdateInventoryDto,
  SuccessResponse,
  PaginatedResponse,
} from '@/types';

export interface InventoryFilters {
  page?: number;
  limit?: number;
  productName?: string;
  expiryTracking?: boolean;
}

export const inventoryService = {
  getAll: async (filters: InventoryFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await api.get<PaginatedResponse<InventoryItem>>(
      `/inventory?${params.toString()}`
    );
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<SuccessResponse<InventoryItem>>(
      `/inventory/${id}`
    );
    return response.data;
  },

  create: async (data: CreateInventoryDto) => {
    const response = await api.post<SuccessResponse<InventoryItem>>(
      '/inventory',
      data
    );
    return response.data;
  },

  update: async (id: string, data: UpdateInventoryDto) => {
    const response = await api.patch<SuccessResponse<InventoryItem>>(
      `/inventory/${id}`,
      data
    );
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<SuccessResponse<null>>(
      `/inventory/${id}`
    );
    return response.data;
  },

  getStockLevels: async () => {
    const response = await api.get<{ total: number; available: number; sold: number }>(
      '/inventory/stock-levels'
    );
    return response.data;
  },

  getLowStockAlerts: async (): Promise<InventoryItem[]> => {
    const response = await api.get<SuccessResponse<InventoryItem[]> | InventoryItem[]>(
      '/inventory/alerts/low-stock'
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  getAvailableForSale: async () => {
    const response = await api.get<SuccessResponse<InventoryItem[]> | InventoryItem[]>(
      '/inventory/available-for-sale'
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },
};