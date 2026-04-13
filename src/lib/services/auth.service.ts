import api from '@/lib/api';
import { LoginDto, LoginResponse, SetupPasswordDto } from '@/types';

export const authService = {
  login: async (data: LoginDto): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  setupPassword: async (data: SetupPasswordDto): Promise<void> => {
    await api.post('/auth/setup-password', data);
  },

  validateToken: async (token: string): Promise<boolean> => {
    const response = await api.post('/auth/validate-token', { token });
    return response.data;
  },
};