'use client';

import { useEffect, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Close sidebar when navigating on tablet
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!mounted || !isAuthenticated) return null;

  return (
    <>
      {/* Mobile block — shown on screens below md (768px) */}
      <div className="flex md:hidden min-h-screen w-full flex-col items-center justify-center bg-background px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </div>
        <h2 className="text-[18px] font-bold tracking-tight mb-2">Not available on mobile</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Enechambs is designed for tablets and desktops. Please open it on a device with a larger screen.
        </p>
      </div>

      {/* App — hidden on mobile, visible on tablet and up */}
      <div className="hidden md:flex min-h-screen w-full bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div
          className={`flex-1 min-w-0 flex flex-col lg:ml-64 ${
            sidebarOpen ? 'md:ml-52' : 'ml-0'
          }`}
        >
          <header className="h-14 border-b bg-card flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-30">
            {/* Hamburger — tablet only */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="md:flex lg:hidden shrink-0 items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <button
              onClick={() => setActivityOpen(true)}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActivityPage
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Bell size={16} />
              Activity
            </button>
          </header>
          <main className="flex-1 p-4 lg:p-8">{children}</main>
        </div>
        <ActivityPanel open={activityOpen} onClose={() => setActivityOpen(false)} />
        <StaffGuide />
      </div>
    </>
  );
}
