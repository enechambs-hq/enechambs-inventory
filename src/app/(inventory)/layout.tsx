'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import ActivityPanel from '@/components/layout/ActivityPanel';
import StaffGuide from '@/components/layout/StaffGuide';
import GlobalSearch from '@/components/layout/GlobalSearch';
import api from '@/lib/api';
import { useCreditNotificationStore } from '@/store/creditNotification.store';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthGuard();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const [activityOpen, setActivityOpen] = useState(false);
  const isActivityPage = pathname === '/activity';
  const fetchOverdueCount = useCreditNotificationStore((s) => s.fetch);

  useEffect(() => {
    setMounted(true);
    api.get('/inventory?limit=1').catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOverdueCount();
    const interval = setInterval(fetchOverdueCount, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchOverdueCount]);

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        {/* Topbar */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-8 sticky top-0 z-30">
          <GlobalSearch />
          <button
            onClick={() => setActivityOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              isActivityPage
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Bell size={16} />
            Activity
          </button>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>

      <ActivityPanel open={activityOpen} onClose={() => setActivityOpen(false)} />
      <StaffGuide />
    </div>
  );
}
