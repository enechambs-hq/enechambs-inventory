import api from '@/lib/api';
import { SalesReport, StockReport, CategoryReport } from '@/types';

export const reportsService = {
  getSalesReport: async (startDate: string, endDate: string): Promise<SalesReport> => {
    const response = await api.get('/reports/sales', { params: { startDate, endDate } });
    return response.data;
  },

  getStockReport: async (): Promise<StockReport> => {
    const response = await api.get('/reports/stock');
    return response.data;
  },

  getCategoryReport: async (startDate: string, endDate: string): Promise<CategoryReport> => {
    const response = await api.get('/reports/categories', { params: { startDate, endDate } });
    return response.data;
  },
};
