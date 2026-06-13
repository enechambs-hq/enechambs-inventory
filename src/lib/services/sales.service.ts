import api from '@/lib/api';
import {
  Sale,
  CreateSaleDto,
  BulkSaleDto,
  SaleTransaction,
  SuccessResponse,
  PaginatedResponse,
} from '@/types';

export interface SaleFilters {
  page?: number;
  limit?: number;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  isVendor?: boolean;
}

type MaybeWrapped<T> = SuccessResponse<T> | T;

function unwrapPaginated<T>(payload: MaybeWrapped<PaginatedResponse<T>>): PaginatedResponse<T> {
  if (payload && 'success' in payload && 'data' in payload) {
    return (payload as SuccessResponse<PaginatedResponse<T>>).data;
  }
  return payload as PaginatedResponse<T>;
}

function coerceItem(item: SaleTransaction['items'][number]) {
  return {
    ...item,
    amount: Number(item.amount),
    costPrice: Number(item.costPrice),
    unitPrice: Number(item.unitPrice),
    listPrice: Number(item.listPrice ?? item.amount),
    discountAmount: Number(item.discountAmount ?? 0),
    finalPrice: Number(item.finalPrice ?? item.amount),
  };
}

function coerceTransaction(t: SaleTransaction): SaleTransaction {
  return {
    ...t,
    total: Number(t.total),
    items: (t.items ?? []).map(coerceItem),
  };
}

export const salesService = {
  getAll: async (filters: SaleFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await api.get<MaybeWrapped<PaginatedResponse<SaleTransaction>>>(
      `/sales?${params.toString()}`
    );
    const result = unwrapPaginated(response.data);
    return { ...result, data: result.data.map(coerceTransaction) };
  },

  getMySales: async (filters: SaleFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const response = await api.get<MaybeWrapped<PaginatedResponse<SaleTransaction>>>(
      `/sales/my-sales?${params.toString()}`
    );
    const result = unwrapPaginated(response.data);
    return { ...result, data: result.data.map(coerceTransaction) };
  },

  getById: async (id: string) => {
    const response = await api.get<SuccessResponse<Sale>>(`/sales/${id}`);
    return response.data;
  },

  create: async (data: CreateSaleDto) => {
    const response = await api.post<SuccessResponse<Sale>>('/sales', data);
    return response.data;
  },

  bulkCreate: async (data: BulkSaleDto) => {
    const response = await api.post<SuccessResponse<SaleTransaction>>('/sales/bulk', data);
    return response.data;
  },

  getReceipt: async (transactionId: string) => {
    const response = await api.get<string>(`/sales/receipt/${transactionId}`, {
      responseType: 'text',
    });
    return response.data;
  },
};
