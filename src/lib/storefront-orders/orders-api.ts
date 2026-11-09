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
  AdminCustomerListResponse,
  AdminCancellation,
  AdminCustomerRow,
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
const CUSTOMERS = '/admin/storefront-customers';
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

/** Only parameters the backend accepts, and only when they carry a value. */
export function buildCustomerListParams(input: { page?: number; limit?: number; search?: string } = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: Number.isInteger(input.page) && (input.page as number) >= 1 ? (input.page as number) : 1,
    limit: Number.isInteger(input.limit) && (input.limit as number) >= 1 ? Math.min(input.limit as number, 50) : ORDERS_PAGE_SIZE,
  };
  const search = (input.search ?? '').trim().slice(0, 100);
  if (search) params.search = search;
  return params;
}

const num = (v: unknown): number => Number(v ?? 0);

function normaliseCustomer(c: AdminCustomerRow): AdminCustomerRow {
  return { ...c, orderCount: num(c.orderCount), paidOrderCount: num(c.paidOrderCount), totalPaid: num(c.totalPaid) };
}

function normaliseRow(r: AdminOrderRow): AdminOrderRow {
  return { ...r, total: num(r.total), itemCount: num(r.itemCount), chargeCount: num(r.chargeCount), cancellationPending: r.cancellationPending === true };
}

export const NO_CANCELLATION: AdminCancellation = {
  state: 'none', requestedAt: null, reason: null, requestedBy: null, refundAmount: null, refund: null,
  refundStartedAt: null, refundStartedBy: null,
  canRequest: false, canWithdraw: false, canStartRefund: false, canRecordRefund: false, canRecordFailedRefund: false, blockedReason: null,
};

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
    cancellation: d.cancellation
      ? { ...NO_CANCELLATION, ...d.cancellation, refundAmount: d.cancellation.refundAmount === null || d.cancellation.refundAmount === undefined ? null : num(d.cancellation.refundAmount) }
      : NO_CANCELLATION,
    history: d.history ?? [],
    paymentEvents: d.paymentEvents ?? [],
    fulfilment: d.fulfilment ? { ...d.fulfilment, ...(d.fulfilment.deliveryFee !== undefined ? { deliveryFee: num(d.fulfilment.deliveryFee) } : {}) } : {},
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

    /**
     * Admin only. Asks to cancel a PAID order that has not been dispatched. Nothing is refunded and no stock is
     * released yet; the order cannot be dispatched until this is completed or withdrawn. A written reason is mandatory.
     */
    requestCancellation: async (orderNumber: string, reason: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/request-cancellation`, { reason: trimNote(reason) })).data),

    /** Admin only. Marks the manual refund as STARTED (do this before opening Flutterwave). From then on the cancellation cannot be withdrawn. */
    startCancellationRefund: async (orderNumber: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/start-cancellation-refund`, {})).data),

    /** Admin only. Records that Flutterwave CONFIRMS the started refund did not complete. Releases nothing. */
    recordFailedCancellationRefund: async (orderNumber: string, note: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/record-failed-cancellation-refund`, { note: trimNote(note) })).data),

    /**
     * Admin only. Records that the FULL refund was made in the Flutterwave dashboard, with its reference. There is no
     * amount parameter: the backend derives the full amount from the captured payment.
     */
    recordCancellationRefund: async (orderNumber: string, refundReference: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/record-cancellation-refund`, { refundReference: refundReference.trim() })).data),

    /** Admin only. Withdraws a cancellation; the backend refuses once the refund has been started. */
    withdrawCancellation: async (orderNumber: string, note: string): Promise<AdminOrderDetail> =>
      normaliseDetail((await http.post<AdminOrderDetail>(`${ORDERS}/${id(orderNumber)}/withdraw-cancellation`, { note: trimNote(note) })).data),

    /** Admin only: people with an online account, with order count and money paid. */
    customers: async (filters: { page?: number; limit?: number; search?: string } = {}): Promise<AdminCustomerListResponse> => {
      const res = (await http.get<AdminCustomerListResponse>(CUSTOMERS, { params: buildCustomerListParams(filters) })).data;
      return { ...res, data: (res.data ?? []).map(normaliseCustomer) };
    },

    /** Admin only. */
    report: async (input: ReportParamsInput): Promise<StorefrontReport> =>
      (await http.get<StorefrontReport>(REPORTS, { params: buildReportParams(input) })).data,
  };
}
