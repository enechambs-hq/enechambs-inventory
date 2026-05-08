import api from '@/lib/api';

export const stockAlertsService = {
  resolve: async (inventoryId: string) => {
    const response = await api.patch(`/stock-alerts/${inventoryId}/resolve`);
    return response.data;
  },
};
