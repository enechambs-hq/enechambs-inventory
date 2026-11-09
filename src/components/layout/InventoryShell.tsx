'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import ActivityPanel from '@/components/layout/ActivityPanel';
import GlobalSearch from '@/components/layout/GlobalSearch';
import api from '@/lib/api';

export default function InventoryShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthGuard();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const [activityOpen, setActivityOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activityButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const skipRestore = useRef(false);
  const isActivityPage = pathname === '/activity';
  useEffect(() => {
    setMounted(true);
    api.get('/inventory?limit=1').catch(() => {});
  }, []);

  // Close the drawer after navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // While the drawer is open: Escape closes it and the page behind does not scroll.
  // Reaching the desktop width (where the sidebar is always shown) also closes it.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [sidebarOpen]);

  // When the drawer closes (Escape, close button, backdrop, navigation) focus goes back to the menu button,
  // except when a dialog is taking over (the Password button), which looks after focus itself.
  useEffect(() => {
    if (wasOpen.current && !sidebarOpen) {
      if (skipRestore.current) skipRestore.current = false;
      else menuButton.current?.focus();
    }
    wasOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  const closeForDialog = () => {
    if (!sidebarOpen) return;
    skipRestore.current = true;
    setSidebarOpen(false);
  };

  if (!mounted || !isAuthenticated) return null;

  return (
    <>
      {/* The same app at every width: persistent sidebar from 1024px, slide-out drawer below. Width never decides access. */}
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onCloseForDialog={closeForDialog} menuButton={menuButton} />
        <div
          // While the drawer is open the page behind cannot take focus.
          inert={sidebarOpen}
          className={`flex-1 min-w-0 flex flex-col lg:ml-64 ${
            sidebarOpen ? 'md:ml-52' : 'ml-0'
          }`}
        >
          <header className="h-14 border-b bg-card flex items-center gap-2 sm:gap-3 px-4 lg:px-8 sticky top-0 z-30">
            {/* Menu button — below 1024px, where the sidebar is a drawer */}
            <button
              ref={menuButton}
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex lg:hidden shrink-0 items-center justify-center w-11 h-11 -ml-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <GlobalSearch />
            </div>
            <button
              ref={activityButton}
              onClick={() => setActivityOpen(true)}
              aria-label="Activity"
              className={`shrink-0 flex items-center justify-center gap-2 min-h-11 max-sm:w-11 sm:px-3 rounded-md text-sm transition-colors ${
                isActivityPage
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Bell size={16} />
              <span className="max-sm:hidden">Activity</span>
            </button>
          </header>
          <main className="flex-1 p-4 lg:p-8">{children}</main>
        </div>
        <ActivityPanel open={activityOpen} onClose={() => setActivityOpen(false)} triggerRef={activityButton} />
      </div>
    </>
  );
}
