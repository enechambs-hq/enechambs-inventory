'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/types';

export const useAuthGuard = (requiredRole?: UserRole) => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/inventory');
    }
  }, [isAuthenticated, user, requiredRole]);

  return { user, isAuthenticated };
};