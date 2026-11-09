import { create } from 'zustand';
import type { AuthUser } from '@/types';

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
  /** Clears the session. Returns false if a saved credential could not be removed from this browser. */
  clearAuth: () => boolean;
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
    // Every step runs on its own: a storage failure must never leave the in-memory session or the cookie behind (that kept
    // people on a signed-in screen). If a key cannot be removed, its value is overwritten with an empty string, which the
    // app reads as "no credential"; if even that fails the credential may remain, and the caller is told.
    for (const key of ['token', 'user']) {
      try {
        localStorage.removeItem(key);
      } catch {
        try {
          localStorage.setItem(key, '');
        } catch {
          /* checked below */
        }
      }
    }
    try {
      deleteCookie('token');
    } catch {
      /* checked below */
    }
    set({ user: null, token: null, isAuthenticated: false });
    try {
      return !localStorage.getItem('token') && !localStorage.getItem('user') && !/(^|; )token=/.test(document.cookie);
    } catch {
      // Storage cannot even be read here, so it cannot be read back by the app either.
      return true;
    }
  },
}));
