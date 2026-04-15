import { create } from 'zustand';
import { AuthUser } from '@/types';

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0`;
};

// Synchronously read from localStorage on store creation so that a hard
// refresh doesn't reset auth state and redirect authenticated users to login.
const getStoredAuth = (): {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
} => {
  if (typeof window === 'undefined')
    return { user: null, token: null, isAuthenticated: false };
  try {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      return { user: JSON.parse(userStr) as AuthUser, token, isAuthenticated: true };
    }
  } catch {}
  return { user: null, token: null, isAuthenticated: false };
};

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getStoredAuth(),
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setCookie('token', token);
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    deleteCookie('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
