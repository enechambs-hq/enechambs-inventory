'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { AuthUser } from '@/types';

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    if (token && userRaw) {
      try {
        const user: AuthUser = JSON.parse(userRaw);
        setAuth(user, token);
      } catch {
        clearAuth();
      }
    }
  }, []);

  return <>{children}</>;
}