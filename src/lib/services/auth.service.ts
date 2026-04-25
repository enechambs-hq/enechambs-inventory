import api from '@/lib/api';
import { LoginDto, LoginResponse, SetupPasswordDto, RegisterStaffDto } from '@/types';

export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

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

  registerStaff: async (data: RegisterStaffDto): Promise<void> => {
    await api.post('/auth/register-staff', data);
  },

  changePassword: async (data: ChangePasswordDto): Promise<void> => {
    await api.post('/auth/change-password', data);
  },
};