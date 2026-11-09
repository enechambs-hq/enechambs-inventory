import axios from 'axios';
import { STAFF_API_CLIENT_TIMEOUT_MS } from './timeouts.ts';
import { createSessionExpiry } from './auth/session-expiry.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { reportApiFailure } from './monitoring/report.ts';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  // Longer than the proxy's own upstream limit (lib/timeouts.ts), so a slow backend reaches the browser as the proxy's
  // structured 504 rather than as an anonymous client-side timeout.
  timeout: STAFF_API_CLIENT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** The single place a rejected staff token is handled (see lib/auth/session-expiry.ts); */
export const sessionExpiry = createSessionExpiry({
  getToken: () => useAuthStore.getState().token,
  clearLocal: () => useAuthStore.getState().clearAuth(),
  navigate: (url) => window.location.assign(url),
  location: () => ({ pathname: window.location.pathname, search: window.location.search }),
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // The error is always passed on unchanged so the caller keeps its response-specific information.
    const auth = error.config?.headers?.Authorization ?? error.config?.headers?.get?.('Authorization');
    sessionExpiry.handle({ status: error.response?.status, url: error.config?.url, authorization: typeof auth === 'string' ? auth : null });
    // Monitoring: only a server fault (status >= 500) is an incident; 4xx and offline failures are normal operation.
    // Reports the method, the route WITHOUT query or ids, the API's code and its request id; never the body or headers.
    const headers = error.response?.headers;
    reportApiFailure({
      status: error.response?.status,
      method: error.config?.method,
      url: error.config?.url,
      code: typeof error.response?.data?.code === 'string' ? error.response.data.code : undefined,
      requestId: (typeof headers?.get === 'function' ? headers.get('x-request-id') : headers?.['x-request-id']) ?? error.response?.data?.requestId,
      source: 'staff',
    });
    return Promise.reject(error);
  }
);

export default api;