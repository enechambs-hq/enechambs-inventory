import api from '@/lib/api';
import { User, PaginatedResponse } from '@/types';

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
};
