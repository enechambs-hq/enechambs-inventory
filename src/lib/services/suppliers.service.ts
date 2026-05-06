import api from '@/lib/api';
import { Supplier, SuccessResponse } from '@/types';

interface CreateSupplierData {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface UpdateSupplierData {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export const suppliersService = {
  getAll: async (): Promise<Supplier[]> => {
    const response = await api.get<SuccessResponse<Supplier[]> | Supplier[]>('/suppliers');
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  create: async (data: CreateSupplierData): Promise<Supplier> => {
    const response = await api.post<SuccessResponse<Supplier> | Supplier>('/suppliers', data);
    const payload = response.data;
    return 'data' in payload && payload.data ? payload.data : (payload as Supplier);
  },

  update: async (id: number, data: UpdateSupplierData): Promise<Supplier> => {
    const response = await api.patch<SuccessResponse<Supplier> | Supplier>(`/suppliers/${id}`, data);
    const payload = response.data;
    return 'data' in payload && payload.data ? payload.data : (payload as Supplier);
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/suppliers/${id}`);
  },
};
