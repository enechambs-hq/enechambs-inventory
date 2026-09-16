import { create } from 'zustand';
import { AuthUser } from '@/types';

// The middleware (src/proxy.ts) only sees cookies, so the token is mirrored
// into one. It cannot be HttpOnly — the same value has to be readable by the
// axios request interceptor — but it must never travel in clear text.

// Kept in step with JWT_EXPIRES_IN (12h) so the cookie cannot outlive the token
// it mirrors and wave an already-dead session past the middleware.
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

// `Secure` on https only: Safari still refuses Secure cookies on
// http://localhost, so hard-coding it would break local development — and over
// plain http the flag would be the only thing standing between the token and
// the wire anyway.
const cookieAttributes = () => {
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  return `path=/; SameSite=Lax${secure}`;
};

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; ${cookieAttributes()}; max-age=${SESSION_MAX_AGE_SECONDS}`;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; ${cookieAttributes()}; max-age=0`;
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
