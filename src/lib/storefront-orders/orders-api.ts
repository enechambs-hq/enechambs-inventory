/**
 * The staff storefront order and report API, written against a minimal HTTP
 * interface so it is tested without a browser. `src/lib/services/
 * storefront-orders.service.ts` wires it to the existing staff axios client
 * (staff JWT through the admin proxy). It is NOT the customer BFF.
 *
 * Backend base paths (the axios baseURL already ends in /api/v1):
 *   /admin/storefront-orders   list, detail, fulfilment (staff+admin), honour / refund (admin)
 *   /admin/storefront-reports  report (admin)
 *
 * Nothing here can mark an order paid, change a total or an amount, or touch
 * ownership: the backend offers no such route, and this client has no such method.
 */
import type {
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderListResponse,
  AdminOrderRow,
  FulfilmentTarget,
  ReportRange,
  StorefrontReport,
} from '../../types/storefront-orders.ts';
import { lagosRangeToInstants } from './format.ts';

export interface HttpClient {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T; status: number }>;
  post<T>(url: string, body?: unknown): Promise<{ data: T; status: number }>;
  patch<T>(url: string, body?: unknown): Promise<{ data: T; status: number }>;
}

const ORDERS = '/admin/storefront-orders';
const REPORTS = '/admin/storefront-reports';
export const ORDERS_PAGE_SIZE = 10;
export const MAX_SEARCH_LENGTH = 30;

/** Only parameters the backend accepts, and only when they carry a value. */
export function buildOrderListParams(input: AdminOrderFilters = {}): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    page: Number.isInteger(input.page) && (input.page as number) >= 1 ? (input.page as number) : 1,
    limit: Number.isInteger(input.limit) && (input.limit as number) >= 1 ? Math.min(input.limit as number, 50) : ORDERS_PAGE_SIZE,
  };
  if (input.status) params.status = input.status;
  if (input.paymentStatus) params.paymentStatus = input.paymentStatus;
  if (input.needsReview) params.needsReview = true;
  const search = (input.search ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  if (search) params.search = search;
  const { from, to } = lagosRangeToInstants(input.fromDate, input.toDate);
  if (from) params.from = from;
  if (to) params.to = to;
  return params;
}

export interface ReportParamsInput {
  range: ReportRange;
  from?: string;
  to?: string;
}

export function buildReportParams({ range, from, to }: ReportParamsInput): Record<string, string> {
  if (range !== 'custom') return { range };
  return { range, from: from ?? '', to: to ?? '' };
}

const num = (v: unknown): number => Number(v ?? 0);

function normaliseRow(r: AdminOrderRow): AdminOrderRow {
  return { ...r, total: num(r.total), itemCount: num(r.itemCount), chargeCount: num(r.chargeCount) };
}

function normaliseDetail(d: AdminOrderDetail): AdminOrderDetail {
  return {
    ...d,
    subtotal: num(d.subtotal),
    total: num(d.total),
    items: (d.items ?? []).map((i) => ({ ...i, quantity: num(i.quantity), unitPrice: num(i.unitPrice), lineTotal: num(i.lineTotal) })),
    payments: (d.payments ?? []).map((p) => ({
      ...p,
      amount: num(p.amount),
      verifiedAmount: p.verifiedAmount === null || p.verifiedAmount === undefined ? null : num(p.verifiedAmount),
    })),
    history: d.history ?? [],
    paymentEvents: d.paymentEvents ?? [],
    fulfilment: d.fulfilment ?? {},
  };
}

export function createStorefrontOrdersApi(http: HttpClient) {
  const id = (value: string) => encodeURIComponent(value);
  const trimNote = (note: string) => note.trim();

  return {
    list: async (filters: AdminOrderFilters = {}): Promise<AdminOrderListResponse> => {
      const res = (await http.get<AdminOrderListResponse>(ORDERS, { params: buildOrderListParams(filters) })).data;
      return { ...res, data: (res.data ?? []).map(normaliseRow) };
    },

    get: async (orderNumber: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.get<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}`)).data),

    /** Staff and admin. The backend refuses anything but a forward step on a PAID order. */
    updateFulfilment: async (orderNumber: string, status: FulfilmentTarget): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.patch<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/fulfilment`, { status })).data),

    /** Admin only (the backend answers 403 to anyone else). A written reason is mandatory. */
    honourLatePayment: async (orderNumber: string, note: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/honour-late-payment`, { note: trimNote(note) })).data),

    /** Admin only. Records the decision and its date; the money itself is returned in the Flutterwave dashboard. */
    recordRefund: async (orderNumber: string, paymentId: string, note: string): Promise<AdminOrderDetail> =>
      normaliseDetail(
        (await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/payments/${id(paymentId)}/record-refund`, { note: trimNote(note) })).data,
      ),

    /** Admin only. */
    report: async (input: ReportParamsInput): Promise<StorefrontReport> =>
      (await http.get<StorefrontReport>(REPORTS, { params: buildReportParams(input) })).data,
  };
}
