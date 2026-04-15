import api from '@/lib/api';
import { SuccessResponse, ActivityLog } from '@/types';

export interface DashboardStats {
  totalInventory: number;
  totalSales: number;
  totalRevenue: number;
  availableStock: number;
  soldStock: number;
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
  totalRevenue: number;
  salesCount: number;
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
    const response = await api.get<SuccessResponse<ActivityLog[]> | ActivityLog[]>(
      `/activity-logs/recent?limit=${limit}`
    );
    const payload = response.data;
    return Array.isArray(payload) ? payload : (payload.data ?? []);
  },
};
