import axios from 'axios';
import { STAFF_API_CLIENT_TIMEOUT_MS } from './timeouts.ts';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;