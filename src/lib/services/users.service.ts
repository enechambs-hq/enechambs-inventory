import api from '@/lib/api';
import { User, UpdateUserDto, UserPerformance, PaginatedResponse, SuccessResponse } from '@/types';

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export const usersService = {
  getAll: async (filters: UserFilters = {}): Promise<PaginatedResponse<User>> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const response = await api.get<PaginatedResponse<User>>(
      `/users?${params.toString()}`
    );
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await api.get<SuccessResponse<User> | User>(`/users/${id}`);
    const payload = response.data;
    return ('data' in payload && payload.data !== undefined ? payload.data : payload) as User;
  },

  update: async (id: string, data: UpdateUserDto): Promise<User> => {
    const response = await api.patch<SuccessResponse<User> | User>(`/users/${id}`, data);
    const payload = response.data;
    return ('data' in payload && payload.data !== undefined ? payload.data : payload) as User;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  getPerformance: async (): Promise<UserPerformance[]> => {
    const response = await api.get<SuccessResponse<UserPerformance[]> | UserPerformance[]>(
      '/users/performance'
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },
};
