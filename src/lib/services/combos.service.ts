import api from '@/lib/api';
import { createCombosApi, type HttpClient } from '@/lib/combos/combos-api';

/**
 * Admin combo API over the existing staff-authenticated axios client
 * (admin proxy, Bearer token from the staff session). It is NOT the customer
 * BFF (/api/store).
 */
const http: HttpClient = {
  get: (url, config) => api.get(url, config),
  post: (url, body) => api.post(url, body),
  put: (url, body) => api.put(url, body),
  patch: (url, body) => api.patch(url, body),
  delete: (url) => api.delete(url),
};

export const combosService = createCombosApi(http);
