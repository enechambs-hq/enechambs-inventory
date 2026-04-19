import { create } from 'zustand';
import { dashboardService } from '@/lib/services/dashboard.service';
import { CreditStatus } from '@/types';

interface CreditNotificationState {
  overdueCount: number;
  fetch: () => Promise<void>;
}

export const useCreditNotificationStore = create<CreditNotificationState>((set) => ({
  overdueCount: 0,
  fetch: async () => {
    try {
      const stats = await dashboardService.getCreditStats();
      set({ overdueCount: stats.byStatus?.[CreditStatus.OVERDUE] ?? 0 });
    } catch {
      // fail silently — badge just won't show
    }
  },
}));
