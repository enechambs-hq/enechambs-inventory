'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/lib/services/auth.service';
import { UserRole } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const staffLinks = [
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/collections', label: 'Collections', icon: Wallet },
];

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ...staffLinks,
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const links = user?.role === UserRole.ADMIN ? adminLinks : staffLinks;

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // fail silently, clear anyway
    } finally {
      clearAuth();
      router.push('/login');
      toast.success('Logged out successfully');
    }
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col border-r bg-card">
      {/* Logo */}
      <div className="px-6 py-5 border-b">
        <h1 className="text-xl font-bold tracking-tight">Lmart</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Inventory</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t">
        <div className="mb-3 px-2">
          <p className="text-sm font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}