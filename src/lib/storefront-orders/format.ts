/**
 * Display rules and UI hints for the staff storefront screens. Pure; relative
 * imports only (the node:test suite loads this directly).
 *
 * The hints here (which buttons to offer) only decide what to SHOW. The
 * backend validates every transition and role again and is the authority.
 */
import type {
  AdminOrderDetail,
  AdminOrderRow,
  AdminOrderStatus,
  AdminPayment,
  AdminPaymentStatus,
  FulfilmentTarget,
  ReportRange,
  ReviewReason,
} from '../../types/storefront-orders.ts';

export const LAGOS_TZ = 'Africa/Lagos';
/** Lagos is UTC+1 all year (no daylight saving). */
const LAGOS_OFFSET = '+01:00';
export const MAX_REPORT_DAYS = 366;

export const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Processing',
  dispatched: 'Sent out',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const PAYMENT_STATUS_LABEL: Record<AdminPaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  review: 'Needs review',
  refunded: 'Refunded',
  failed: 'Failed',
};

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  late_payment: 'Late payment',
  duplicate_charge: 'Duplicate charge',
  payment_mismatch: 'Amount or currency mismatch',
};

export const RECONCILIATION_LABEL: Record<string, string> = {
  duplicate_charge: 'Duplicate charge',
  late_payment: 'Late payment',
  amount_mismatch: 'Amount mismatch',
  currency_mismatch: 'Currency mismatch',
};

export const PAYMENT_RECORD_LABEL: Record<string, string> = {
  initiated: 'Checkout opened',
  paid: 'Paid',
  failed: 'Failed',
  quarantined: 'Held for review',
  refunded: 'Refunded',
};

export const HISTORY_EVENT_LABEL: Record<string, string> = {
  created: 'Order placed',
  payment_started: 'Checkout started',
  payment_confirmed: 'Payment verified and confirmed',
  payment_failed: 'Provider reported a failed payment',
  payment_under_review: 'Payment flagged for review',
  duplicate_charge_recorded: 'Duplicate charge recorded',
  order_honoured: 'Late payment honoured',
  refund_recorded: 'Refund decision recorded',
  processing: 'Moved to processing',
  dispatched: 'Marked as sent out',
  completed: 'Marked as delivered (customer has it)',
  cancelled: 'Cancelled',
  expired: 'Payment window ended',
};

export const ORDER_STATUS_OPTIONS: Array<{ value: AdminOrderStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  ...(Object.keys(ORDER_STATUS_LABEL) as AdminOrderStatus[]).map((value) => ({ value, label: ORDER_STATUS_LABEL[value] })),
];

export const PAYMENT_STATUS_OPTIONS: Array<{ value: AdminPaymentStatus | ''; label: string }> = [
  { value: '', label: 'All payments' },
  ...(Object.keys(PAYMENT_STATUS_LABEL) as AdminPaymentStatus[]).map((value) => ({ value, label: PAYMENT_STATUS_LABEL[value] })),
];

export const REPORT_RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'custom', label: 'Custom range' },
];

// ── money and time ───────────────────────────────────────────────────────────
const nairaFormat = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function formatNaira(n: number): string {
  const value = Number(n);
  if (!Number.isFinite(value)) return '₦0';
  return `${value < 0 ? '-' : ''}₦${nairaFormat.format(Math.abs(value))}`;
}

const lagosDateTime = new Intl.DateTimeFormat('en-NG', { timeZone: LAGOS_TZ, dateStyle: 'medium', timeStyle: 'short' });
const lagosDay = new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "4 Nov 2026, 3:15 pm", always Lagos time, whatever the staff member's computer says. */
export function formatLagosDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : lagosDateTime.format(d);
}

/** The Lagos calendar date (YYYY-MM-DD) of an instant. */
export const lagosDateOf = (at: Date): string => lagosDay.format(at);

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export const daysBetweenInclusive = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * Inclusive Lagos days -> the half-open instant range the order list API takes
 * (`from` inclusive, `to` EXCLUSIVE): midnight at the start of `fromDate`
 * to midnight at the end of `toDate`, both in Lagos time.
 */
export function lagosRangeToInstants(fromDate?: string, toDate?: string): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (fromDate && isValidIsoDate(fromDate)) out.from = `${fromDate}T00:00:00${LAGOS_OFFSET}`;
  if (toDate && isValidIsoDate(toDate)) out.to = `${addDaysIso(toDate, 1)}T00:00:00${LAGOS_OFFSET}`;
  return out;
}

export function customRangeError(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both a start and an end date.';
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return 'Enter valid dates.';
  if (from > to) return 'The start date is after the end date.';
  if (daysBetweenInclusive(from, to) > MAX_REPORT_DAYS) return `Choose at most ${MAX_REPORT_DAYS} days.`;
  return null;
}

// ── what to show for an order ────────────────────────────────────────────────
/** Which fulfilment steps to OFFER. Mirrors the backend's rule: only PAID orders move, and only forward. */
export function fulfilmentTargets(order: Pick<AdminOrderRow | AdminOrderDetail, 'status' | 'paymentStatus'>): FulfilmentTarget[] {
  if (order.paymentStatus !== 'paid') return [];
  if (order.status === 'confirmed') return ['processing'];
  if (order.status === 'processing') return ['dispatched'];
  if (order.status === 'dispatched') return ['completed'];
  return [];
}

export type FulfilmentMethod = 'delivery' | 'pickup';

export interface FulfilmentAction {
  /** The button. */
  label: string;
  /** The question in the confirm dialog (it says what the customer will see and be emailed). */
  question: string;
  /** The toast once it is saved. */
  done: string;
}

/**
 * Wording for each fulfilment step. A delivery order is "sent out" and
 * "delivered"; a pickup order is "ready for pickup" and "collected". An order
 * with no recorded method (placed before delivery existed) reads as pickup,
 * like the emails the API sends.
 */
export function fulfilmentAction(target: FulfilmentTarget, method: FulfilmentMethod | null | undefined): FulfilmentAction {
  const delivery = method === 'delivery';
  switch (target) {
    case 'processing':
      return {
        label: 'Start processing',
        question: 'Move this order to processing? The customer sees "Being prepared" and is emailed.',
        done: 'Order moved to processing.',
      };
    case 'dispatched':
      return delivery
        ? {
            label: 'Mark as sent out',
            question: 'Mark this order as sent out for delivery? The customer sees "On its way" and is emailed.',
            done: 'Order marked as sent out.',
          }
        : {
            label: 'Mark as ready for pickup',
            question: 'Mark this order as ready for pickup? The customer sees "Ready for pickup" and is emailed.',
            done: 'Order marked as ready for pickup.',
          };
    case 'completed':
      return delivery
        ? {
            label: 'Mark as delivered',
            question: 'Confirm the customer has received this order? It is marked delivered, the customer is emailed, and the order is closed. This cannot be undone.',
            done: 'Order marked as delivered.',
          }
        : {
            label: 'Mark as collected',
            question: 'Confirm the customer has collected this order? It is marked collected, the customer is emailed, and the order is closed. This cannot be undone.',
            done: 'Order marked as collected.',
          };
  }
}

/** A late payment awaiting an administrator's decision (the order was already expired or cancelled). */
export function awaitsLatePaymentDecision(order: Pick<AdminOrderDetail, 'status' | 'paymentStatus' | 'reviewReason'>): boolean {
  return order.paymentStatus === 'review' && order.reviewReason === 'late_payment' && (order.status === 'expired' || order.status === 'cancelled');
}

/** Payments an administrator may record a refund decision for: collected and flagged. */
export function refundablePayments(order: Pick<AdminOrderDetail, 'payments'>): AdminPayment[] {
  return order.payments.filter((p) => (p.status === 'paid' || p.status === 'quarantined') && p.reconciliation !== null);
}

export interface PaymentDeadline {
  label: string;
  overdue: boolean;
}

/** The payment deadline, only while the order is still waiting for payment. */
export function paymentDeadline(row: Pick<AdminOrderRow, 'awaitingPayment' | 'expiresAt'>, now: Date = new Date()): PaymentDeadline | null {
  if (!row.awaitingPayment) return null;
  const at = new Date(row.expiresAt);
  if (Number.isNaN(at.getTime())) return null;
  return { label: formatLagosDateTime(row.expiresAt), overdue: at.getTime() <= now.getTime() };
}

export interface OrderWarning {
  key: string;
  label: string;
}

/** Warning chips for the order list. */
export function orderWarnings(row: AdminOrderRow, now: Date = new Date()): OrderWarning[] {
  const out: OrderWarning[] = [];
  if (row.reviewReason) out.push({ key: row.reviewReason, label: REVIEW_REASON_LABEL[row.reviewReason] });
  else if (row.paymentStatus === 'review') out.push({ key: 'review', label: 'Needs review' });
  if (row.chargeCount > 1 && row.reviewReason !== 'duplicate_charge') out.push({ key: 'multi', label: `${row.chargeCount} charges` });
  if (paymentDeadline(row, now)?.overdue) out.push({ key: 'overdue', label: 'Payment overdue' });
  return out;
}

/** Customer-facing wording is not reused here: staff see the real state names. */
export const shortOrderNumber = (n: string): string => n.replace(/^ENE-/, '');
