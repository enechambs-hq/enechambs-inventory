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
  userId: string;
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
  getStats: async () => {
    const response = await api.get<SuccessResponse<DashboardStats>>(
      '/dashboard/stats'
    );
    return response.data;
  },

  getStaffPerformance: async () => {
    const response = await api.get<SuccessResponse<StaffPerformance[]>>(
      '/dashboard/staff-performance'
    );
    return response.data;
  },

  getRevenueChart: async (startDate: string, endDate: string) => {
    const response = await api.get<SuccessResponse<RevenueDataPoint[]>>(
      `/dashboard/revenue-chart?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  getRecentActivity: async (limit = 10) => {
    const response = await api.get<SuccessResponse<ActivityLog[]>>(
      `/activity-logs/recent?limit=${limit}`
    );
    return response.data;
  },
};