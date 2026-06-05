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

function coerceItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    quantity: Number(item.quantity),
    costPrice: Number(item.costPrice),
    sellingPrice: Number(item.sellingPrice),
    restockThreshold: Number(item.restockThreshold),
  };
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
    const result = response.data;
    if (result?.data && Array.isArray(result.data)) {
      result.data = result.data.map(coerceItem);
    }
    return result;
  },

  getById: async (id: string) => {
    const response = await api.get<SuccessResponse<InventoryItem>>(
      `/inventory/${id}`
    );
    const result = response.data;
    if (result?.data) result.data = coerceItem(result.data);
    return result;
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

  restock: async (id: string, qty: number) => {
    const response = await api.patch<SuccessResponse<InventoryItem>>(
      `/inventory/${id}/restock`,
      { quantity: qty },
    );
    return response.data;
  },

  getStockLevels: async () => {
    const response = await api.get<{ total: number; available: number; outOfStock: number }>(
      '/inventory/stock-levels'
    );
    return response.data;
  },

  getLowStockAlerts: async (): Promise<InventoryItem[]> => {
    const response = await api.get<SuccessResponse<InventoryItem[]> | InventoryItem[]>(
      '/inventory/alerts/low-stock'
    );
    const payload = response.data;
    const items = Array.isArray(payload) ? payload : (payload.data ?? []);
    return items.map(coerceItem);
  },

  getAvailableForSale: async () => {
    const response = await api.get<SuccessResponse<InventoryItem[]> | InventoryItem[]>(
      '/inventory/available-for-sale'
    );
    const payload = response.data;
    const items = Array.isArray(payload) ? payload : (payload.data ?? []);
    return items.map(coerceItem);
  },

  getStockValue: async (): Promise<import('@/types').StockValueResponse> => {
    const res = await api.get('/inventory/stock-value');
    return res.data;
  },
};