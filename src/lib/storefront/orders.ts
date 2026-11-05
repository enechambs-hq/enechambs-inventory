/**
 * Customer-facing order shapes, parsed field by field from the API's
 * whitelisted responses (enechambs-api `src/orders/order-serializer.ts`).
 * Unknown fields are dropped, so nothing the API adds later can leak into the
 * page by accident. Relative imports only (node:test loads this).
 */
export type OrderState = 'awaiting_payment' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'expired' | 'under_review';
export type PaymentState = 'unpaid' | 'awaiting_payment' | 'paid' | 'failed' | 'under_review' | 'refunded';

const ORDER_STATES: readonly OrderState[] = ['awaiting_payment', 'paid', 'processing', 'completed', 'cancelled', 'expired', 'under_review'];
const PAYMENT_STATES: readonly PaymentState[] = ['unpaid', 'awaiting_payment', 'paid', 'failed', 'under_review', 'refunded'];

export interface OrderLine {
  slug: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderSummary {
  orderNumber: string;
  state: OrderState;
  paymentState: PaymentState;
  currency: string;
  total: number;
  createdAt: string;
  canPay: boolean;
}

export interface TimelineEntry {
  event: string;
  at: string;
}

export interface CustomerOrder extends OrderSummary {
  subtotal: number;
  items: OrderLine[];
  contact: { name: string | null; phone: string | null; note: string | null };
  canCancel: boolean;
  expiresAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  timeline: TimelineEntry[];
}

export interface OrderList {
  data: OrderSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ORDER_NUMBER = /^ENE-[A-Z0-9]{8}$/;
export const isOrderNumber = (v: string): boolean => ORDER_NUMBER.test(v);

export function parseOrderSummary(v: unknown): OrderSummary | null {
  if (!isObject(v)) return null;
  const orderNumber = str(v.orderNumber);
  const state = str(v.state) as OrderState | null;
  const paymentState = str(v.paymentState) as PaymentState | null;
  const total = num(v.total);
  const createdAt = str(v.createdAt);
  if (!orderNumber || !isOrderNumber(orderNumber) || total === null || !createdAt) return null;
  if (!state || !ORDER_STATES.includes(state) || !paymentState || !PAYMENT_STATES.includes(paymentState)) return null;
  return { orderNumber, state, paymentState, currency: str(v.currency) ?? 'NGN', total, createdAt, canPay: v.canPay === true };
}

function parseLine(v: unknown): OrderLine | null {
  if (!isObject(v)) return null;
  const slug = str(v.slug);
  const name = str(v.name);
  const quantity = num(v.quantity);
  const unitPrice = num(v.unitPrice);
  const lineTotal = num(v.lineTotal);
  if (!slug || !name || quantity === null || unitPrice === null || lineTotal === null) return null;
  return { slug, name, quantity, unitPrice, lineTotal };
}

export function parseCustomerOrder(v: unknown): CustomerOrder | null {
  const base = parseOrderSummary(v);
  if (!base || !isObject(v)) return null;
  const subtotal = num(v.subtotal);
  if (subtotal === null || !Array.isArray(v.items)) return null;
  const items = v.items.map(parseLine);
  if (items.some((i) => i === null)) return null;
  const contact = isObject(v.contact) ? v.contact : {};
  const timeline = (Array.isArray(v.timeline) ? v.timeline : [])
    .map((t) => (isObject(t) && str(t.event) && str(t.at) ? { event: str(t.event) as string, at: str(t.at) as string } : null))
    .filter((t): t is TimelineEntry => t !== null);
  return {
    ...base,
    subtotal,
    items: items as OrderLine[],
    contact: { name: str(contact.name), phone: str(contact.phone), note: str(contact.note) },
    canCancel: v.canCancel === true,
    expiresAt: str(v.expiresAt),
    paidAt: str(v.paidAt),
    paymentReference: str(v.paymentReference),
    timeline,
  };
}

export function parseOrderList(v: unknown): OrderList | null {
  if (!isObject(v) || !Array.isArray(v.data) || !isObject(v.meta)) return null;
  const data = v.data.map(parseOrderSummary);
  if (data.some((d) => d === null)) return null;
  const { total, page, limit, totalPages } = v.meta as Record<string, unknown>;
  if (num(total) === null || num(page) === null || num(limit) === null || num(totalPages) === null) return null;
  return {
    data: data as OrderSummary[],
    meta: { total: total as number, page: page as number, limit: limit as number, totalPages: totalPages as number },
  };
}

export function parseCheckoutUrl(v: unknown): string | null {
  return isObject(v) && typeof v.checkoutUrl === 'string' ? v.checkoutUrl : null;
}

// ── quote (cart/quote) ────────────────────────────────────────────────────────
export type QuoteIssue = 'unavailable' | 'insufficient_stock' | 'quantity_limit';
export interface QuoteLine {
  slug: string;
  name: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  purchasable: boolean;
  issue: QuoteIssue | null;
}
export interface Quote {
  currency: string;
  lines: QuoteLine[];
  total: number;
  withinOrderLimit: boolean;
  limits: { maxPerLine: number; maxPerOrder: number };
}

export function parseQuote(v: unknown): Quote | null {
  if (!isObject(v) || !Array.isArray(v.lines) || !isObject(v.limits)) return null;
  const total = num(v.total);
  const maxPerLine = num(v.limits.maxPerLine);
  const maxPerOrder = num(v.limits.maxPerOrder);
  if (total === null || maxPerLine === null || maxPerOrder === null) return null;
  const lines: QuoteLine[] = [];
  for (const raw of v.lines) {
    if (!isObject(raw)) return null;
    const slug = str(raw.slug);
    const quantity = num(raw.quantity);
    if (!slug || quantity === null) return null;
    const issue = str(raw.issue) as QuoteIssue | null;
    if (issue !== null && !['unavailable', 'insufficient_stock', 'quantity_limit'].includes(issue)) return null;
    lines.push({
      slug,
      name: str(raw.name),
      quantity,
      unitPrice: num(raw.unitPrice),
      lineTotal: num(raw.lineTotal),
      purchasable: raw.purchasable === true,
      issue,
    });
  }
  return { currency: str(v.currency) ?? 'NGN', lines, total, withinOrderLimit: v.withinOrderLimit === true, limits: { maxPerLine, maxPerOrder } };
}

/** Everything in the cart can be bought as quoted and the order is within limits. */
export const quoteIsPurchasable = (q: Quote): boolean => q.lines.length > 0 && q.lines.every((l) => l.purchasable) && q.withinOrderLimit;

export const issueMessage = (issue: QuoteIssue | null, limits?: { maxPerLine: number }): string => {
  if (issue === 'unavailable') return 'No longer available';
  if (issue === 'insufficient_stock') return 'Not enough left for this quantity';
  if (issue === 'quantity_limit') return limits ? `At most ${limits.maxPerLine} per order` : 'Over the per-order limit';
  return '';
};

// ── the signed-in customer (auth/me) ─────────────────────────────────────────
export interface CustomerProfile {
  name: string;
  phone: string;
  email: string;
}
export function parseProfile(v: unknown): CustomerProfile | null {
  if (!isObject(v)) return null;
  const name = str(v.customerName);
  const phone = str(v.customerPhone);
  const email = str(v.email);
  return name && phone && email ? { name, phone, email } : null;
}

// ── display ───────────────────────────────────────────────────────────────────
export const ORDER_STATE_LABEL: Record<OrderState, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  processing: 'Being prepared',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  under_review: 'Payment under review',
};

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  unpaid: 'Not paid',
  awaiting_payment: 'Waiting for your payment',
  paid: 'Paid',
  failed: 'Payment failed',
  under_review: 'Under review',
  refunded: 'Refunded',
};

export const TIMELINE_LABEL: Record<string, string> = {
  created: 'Order placed',
  payment_confirmed: 'Payment confirmed',
  payment_under_review: 'Payment under review',
  order_honoured: 'Order confirmed after review',
  refund_recorded: 'Refund recorded',
  processing: 'Being prepared',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Payment window ended',
};

/** Statuses after which the payment-return page can stop asking the API. */
export function paymentSettled(order: Pick<CustomerOrder, 'state' | 'paymentState'>): boolean {
  if (order.paymentState === 'paid' || order.paymentState === 'under_review' || order.paymentState === 'refunded') return true;
  return order.state === 'cancelled' || order.state === 'expired';
}
