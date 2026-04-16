import api from '@/lib/api';
import { SuccessResponse, ActivityLog, DailySummary, WeeklySummary, MonthlySummary, TopProduct, ProfitReport, CollectionsStats, CreditStats } from '@/types';

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
    const response = await api.get<ActivityLog[]>(`/activity-logs/recent?limit=${limit}`);
    return Array.isArray(response.data) ? response.data : [];
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

  getTopProducts: async (): Promise<TopProduct[]> => {
    const response = await api.get<TopProduct[]>('/dashboard/top-products', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    return Array.isArray(response.data) ? response.data : [];
  },
};
