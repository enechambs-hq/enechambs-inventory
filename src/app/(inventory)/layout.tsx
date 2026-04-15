'use client';

import { useEffect, useState } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import api from '@/lib/api';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthGuard();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Warm up the Render free-tier server so it isn't cold when the user submits a form
    api.get('/inventory?limit=1').catch(() => {});
  }, []);

  // Return null on the server and on the very first client render so that
  // both sides produce identical output and React hydration succeeds.
  // After mount, the actual auth-aware layout renders.
  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
