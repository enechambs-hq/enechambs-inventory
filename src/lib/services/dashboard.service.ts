import api from '@/lib/api';
import { SuccessResponse, ActivityLog, DailySummary, WeeklySummary, MonthlySummary, TopProduct, ProfitReport, CollectionsStats, CreditStats, Customer, Vendor, PaginatedResponse } from '@/types';

export interface DashboardStats {
  totalInventory: number;
  totalSales: number;
  totalRevenue: number;
  availableInventory: number;
  totalCollections: number;
  lowStockAlerts: number;
  credits: {
    total: number;
    paid: number;
    outstanding: number;
    overdue: number;
  };
  recentActivities: import('@/types').ActivityLog[];
  recentSales: import('@/types').Sale[];
}

export interface StaffPerformance {
  userId?: string;
  name: string;
  totalSales: number;
  totalRevenue: number;
  totalCollections: number;
}

export interface RevenueDataPoint {
  date: string;
  total: string;
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<SuccessResponse<DashboardStats> | DashboardStats>(
      '/dashboard/stats'
    );
    const payload = response.data;
    return ('data' in payload && payload.data !== undefined ? payload.data : payload) as DashboardStats;
  },

  getStaffPerformance: async (): Promise<StaffPerformance[]> => {
    const response = await api.get<SuccessResponse<StaffPerformance[]> | StaffPerformance[]>(
      '/dashboard/staff-performance'
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  getRevenueChart: async (startDate: string, endDate: string): Promise<RevenueDataPoint[]> => {
    const response = await api.get<SuccessResponse<RevenueDataPoint[]> | RevenueDataPoint[]>(
      `/dashboard/revenue-chart?startDate=${startDate}&endDate=${endDate}`
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  getRecentActivity: async (limit = 10): Promise<ActivityLog[]> => {
    const response = await api.get<ActivityLog[] | { data: ActivityLog[] }>(`/activity-logs/recent?limit=${limit}`);
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },

  getAllActivity: async (page = 1, limit = 20): Promise<import('@/types').PaginatedResponse<ActivityLog>> => {
    const response = await api.get(`/activity-logs?page=${page}&limit=${limit}`);
    return response.data;
  },

  getDaily: async (): Promise<DailySummary> => {
    const response = await api.get<DailySummary>('/dashboard/daily');
    return response.data;
  },

  getWeekly: async (): Promise<WeeklySummary> => {
    const response = await api.get<WeeklySummary>('/dashboard/weekly');
    return response.data;
  },

  getMonthly: async (): Promise<MonthlySummary> => {
    const response = await api.get<MonthlySummary>('/dashboard/monthly');
    return response.data;
  },

  getCreditStats: async (): Promise<CreditStats> => {
    const response = await api.get<CreditStats>('/dashboard/credit-stats');
    return response.data;
  },

  getCollectionsStats: async (): Promise<CollectionsStats> => {
    const response = await api.get<CollectionsStats>('/dashboard/collections-stats');
    return response.data;
  },

  getProfitReport: async (startDate: string, endDate: string): Promise<ProfitReport> => {
    const response = await api.get<ProfitReport>(
      `/dashboard/profit-report?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  getAllCustomers: async (page = 1, limit = 20, search = ''): Promise<PaginatedResponse<Customer>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    const response = await api.get(`/dashboard/customers?${params}`);
    return response.data;
  },

  getCustomers: async (page = 1, limit = 20, search = ''): Promise<PaginatedResponse<Vendor>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    const response = await api.get<SuccessResponse<PaginatedResponse<Vendor>> | PaginatedResponse<Vendor>>(`/customers/regular?${params}`);
    const payload = response.data;
    return ('data' in payload && 'meta' in (payload.data as object) ? payload.data : payload) as PaginatedResponse<Vendor>;
  },

  globalSearch: async (query: string, limit = 10): Promise<{
    results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      description: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    meta: { total: number; page: number; limit: number };
  }> => {
    const params = new URLSearchParams({ query, limit: String(limit) });
    const response = await api.get(`/search?${params}`);
    return response.data;
  },

  searchCustomers: async (query: string): Promise<Vendor[]> => {
    if (!query.trim()) return [];
    const params = new URLSearchParams({ customerName: query.trim(), limit: '8' });
    const response = await api.get<SuccessResponse<PaginatedResponse<Vendor>> | PaginatedResponse<Vendor>>(`/customers?${params}`);
    const payload = response.data;
    const result = ('data' in payload && 'meta' in (payload.data as object) ? payload.data : payload) as PaginatedResponse<Vendor>;
    return result.data ?? [];
  },

  getVendors: async (page = 1, limit = 20, search = ''): Promise<PaginatedResponse<Vendor>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    const response = await api.get<SuccessResponse<PaginatedResponse<Vendor>> | PaginatedResponse<Vendor>>(`/customers/vendors?${params}`);
    const payload = response.data;
    return ('data' in payload && 'meta' in (payload.data as object) ? payload.data : payload) as PaginatedResponse<Vendor>;
  },

  broadcastEmail: async (subject: string, message: string, senderName?: string): Promise<{
    success: boolean;
    message: string;
    subject: string;
    totalRecipients: number;
    successful: number;
    failed: number;
  }> => {
    const response = await api.post('/dashboard/broadcast-email', {
      subject,
      message,
      ...(senderName ? { senderName } : {}),
    });
    return response.data;
  },

  getActivityByUser: async (userId: string, page = 1, limit = 20): Promise<PaginatedResponse<ActivityLog>> => {
    const response = await api.get(`/activity-logs/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  getTopProducts: async (): Promise<TopProduct[]> => {
    const response = await api.get<TopProduct[]>('/dashboard/top-products');
    return Array.isArray(response.data) ? response.data : [];
  },
};
