'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import Sidebar from '@/components/layout/Sidebar';

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthGuard();

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}