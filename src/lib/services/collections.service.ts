import api from '@/lib/api';
import {
  Collection,
  CreateCollectionDto,
  CollectionStatus,
  PaginatedResponse,
} from '@/types';

export interface CollectionFilters {
  page?: number;
  limit?: number;
  productName?: string;
  collectorName?: string;
}

export const collectionsService = {
  getAll: async (filters: CollectionFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await api.get<PaginatedResponse<Collection>>(
      `/collections?${params.toString()}`
    );
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<Collection>(`/collections/${id}`);
    return response.data;
  },

  create: async (data: CreateCollectionDto) => {
    const response = await api.post<Collection>('/collections', data);
    return response.data;
  },

  updateStatus: async (id: string, status: CollectionStatus, voidReason?: string) => {
    const response = await api.patch<Collection>(
      `/collections/${id}/status`,
      { status, ...(voidReason ? { voidReason } : {}) }
    );
    return response.data;
  },
};