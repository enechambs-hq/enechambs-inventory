import api from '@/lib/api';
import { createStorefrontOrdersApi, type HttpClient } from '@/lib/storefront-orders/orders-api';

/**
 * Staff storefront order/report API over the existing staff-authenticated axios
 * client (Bearer token from the staff session, admin proxy). It is NOT the
 * customer BFF (/api/store): customers and staff never share a client.
 */
const http: HttpClient = {
  get: (url, config) => api.get(url, config),
  post: (url, body) => api.post(url, body),
  patch: (url, body) => api.patch(url, body),
};

export const storefrontOrdersService = createStorefrontOrdersApi(http);
