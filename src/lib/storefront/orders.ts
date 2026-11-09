/**
 * Customer-facing order shapes, parsed field by field from the API's
 * whitelisted responses (enechambs-api `src/orders/order-serializer.ts`).
 * Unknown fields are dropped, so nothing the API adds later can leak into the
 * page by accident. Relative imports only (node:test loads this).
 */
export type OrderState = 'awaiting_payment' | 'paid' | 'processing' | 'dispatched' | 'completed' | 'cancelled' | 'expired' | 'under_review';
export type PaymentState = 'unpaid' | 'awaiting_payment' | 'paid' | 'failed' | 'under_review' | 'refunded';

const ORDER_STATES: readonly OrderState[] = ['awaiting_payment', 'paid', 'processing', 'dispatched', 'completed', 'cancelled', 'expired', 'under_review'];
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
  /** How the order reaches the customer; null for orders from before delivery existed. */
  fulfilmentMethod: FulfilmentMethod | null;
  currency: string;
  total: number;
  createdAt: string;
  canPay: boolean;
}

export interface TimelineEntry {
  event: string;
  at: string;
}

export type FulfilmentMethod = 'delivery' | 'pickup';

/** The address an order was placed with: a copy, so later edits to the address book never change it. */
export interface AddressSnapshot {
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  state: string | null;
}

export interface OrderFulfilment {
  /** Null for orders placed before delivery existed. */
  method: FulfilmentMethod | null;
  deliveryFee: number;
  address: AddressSnapshot | null;
  pickup: { address: string; hours: string } | null;
}

export interface CustomerOrder extends OrderSummary {
  subtotal: number;
  fulfilment: OrderFulfilment;
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
  const fulfilmentMethod = v.fulfilmentMethod === 'delivery' || v.fulfilmentMethod === 'pickup' ? v.fulfilmentMethod : null;
  return { orderNumber, state, paymentState, fulfilmentMethod, currency: str(v.currency) ?? 'NGN', total, createdAt, canPay: v.canPay === true };
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
  const fulfilment = parseFulfilment(v.fulfilment);
  return {
    ...base,
    fulfilmentMethod: base.fulfilmentMethod ?? fulfilment.method,
    subtotal,
    fulfilment,
    items: items as OrderLine[],
    contact: { name: str(contact.name), phone: str(contact.phone), note: str(contact.note) },
    canCancel: v.canCancel === true,
    expiresAt: str(v.expiresAt),
    paidAt: str(v.paidAt),
    paymentReference: str(v.paymentReference),
    timeline,
  };
}

export function parseAddressSnapshot(v: unknown): AddressSnapshot | null {
  if (!isObject(v)) return null;
  const recipientName = str(v.recipientName);
  const recipientPhone = str(v.recipientPhone);
  const addressLine = str(v.addressLine);
  const city = str(v.city);
  if (!recipientName || !recipientPhone || !addressLine || !city) return null;
  return { recipientName, recipientPhone, addressLine, city, state: str(v.state) };
}

export function parseFulfilment(v: unknown): OrderFulfilment {
  const f = isObject(v) ? v : {};
  const pickup = isObject(f.pickup) && str(f.pickup.address) && str(f.pickup.hours) ? { address: str(f.pickup.address) as string, hours: str(f.pickup.hours) as string } : null;
  return {
    method: f.method === 'delivery' || f.method === 'pickup' ? f.method : null,
    deliveryFee: num(f.deliveryFee) ?? 0,
    address: parseAddressSnapshot(f.address),
    pickup,
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
  /** Items only. */
  subtotal: number;
  /** Added to the total for delivery; zero for pickup. */
  deliveryFee: number;
  /** Items plus delivery fee: what the customer pays. */
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
  const deliveryFee = num(v.deliveryFee) ?? 0;
  return { currency: str(v.currency) ?? 'NGN', lines, subtotal: num(v.subtotal) ?? total - deliveryFee, deliveryFee, total, withinOrderLimit: v.withinOrderLimit === true, limits: { maxPerLine, maxPerOrder } };
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
  dispatched: 'Sent out',
  completed: 'Received',
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
  dispatched: 'Sent out',
  completed: 'Received',
  cancelled: 'Cancelled',
  expired: 'Payment window ended',
};

/**
 * What the customer reads for a fulfilment stage. A delivery order is "On its
 * way" then "Received"; a pickup order is "Ready for pickup" then "Received".
 * An order with no recorded method (placed before delivery existed) reads as
 * pickup, like the emails.
 */
const STAGE_WORDS: Record<'dispatched' | 'completed', Record<FulfilmentMethod, string>> = {
  dispatched: { delivery: 'On its way', pickup: 'Ready for pickup' },
  completed: { delivery: 'Received', pickup: 'Received' },
};

export function orderStateLabel(state: OrderState, method?: FulfilmentMethod | null): string {
  if (state === 'dispatched' || state === 'completed') return STAGE_WORDS[state][method === 'delivery' ? 'delivery' : 'pickup'];
  return ORDER_STATE_LABEL[state];
}

/** A sentence for the order page once fulfilment has started; null before that and for orders that did not complete. */
export function stageMessage(state: OrderState, method?: FulfilmentMethod | null): string | null {
  const delivery = method === 'delivery';
  switch (state) {
    case 'processing':
      return 'We are preparing your order. It will be sent out soon.';
    case 'dispatched':
      return delivery ? 'Your order is on its way to you. Please keep your phone close.' : 'Your order is ready. Come and collect it from our store during opening hours.';
    case 'completed':
      return delivery ? 'Your order has been received. Enjoy, and thank you for shopping with us!' : 'Your order has been received. Enjoy, and thank you for shopping with us!';
    default:
      return null;
  }
}

export function timelineLabel(event: string, method?: FulfilmentMethod | null): string {
  if (event === 'dispatched' || event === 'completed') return STAGE_WORDS[event][method === 'delivery' ? 'delivery' : 'pickup'];
  return TIMELINE_LABEL[event] ?? 'Update';
}

/** Statuses after which the payment-return page can stop asking the API. */
export function paymentSettled(order: Pick<CustomerOrder, 'state' | 'paymentState'>): boolean {
  if (order.paymentState === 'paid' || order.paymentState === 'under_review' || order.paymentState === 'refunded') return true;
  return order.state === 'cancelled' || order.state === 'expired';
}

export type PaymentReturnKind = 'paid' | 'under_review' | 'refunded' | 'closed' | 'failed' | 'timeout' | 'pending';
export type PaymentReturnAction = 'view_order' | 'my_orders' | 'continue_shopping' | 'try_again' | 'check_again';
export interface PaymentReturnOutcome {
  kind: PaymentReturnKind;
  tone: 'success' | 'info' | 'warn' | 'error';
  headline: string;
  body: string | null;
  /** In display order; the first is the primary button. `try_again` appears only for an order that can still be paid. */
  actions: PaymentReturnAction[];
}

/**
 * What the payment-return page tells the customer. It is decided ONLY from the order our API returned (which the API
 * verified with the provider by our own reference); the redirect's query string is never an input. The payment status
 * and the order status are read independently: a refunded payment is described as refunded whatever stage the order is
 * in, and nothing here can offer to pay again for a payment that was refunded, is under review or was captured.
 *
 * `polling` is the page's own progress: still asking, gave up after about a minute, or finished (settled).
 */
export function paymentReturnOutcome(order: CustomerOrder, polling: 'checking' | 'timeout' | 'done'): PaymentReturnOutcome {
  if (order.paymentState === 'paid') {
    return {
      kind: 'paid',
      tone: 'success',
      headline: 'Payment confirmed',
      // The next step follows the order's actual stage: "we will prepare it" only while it is still just paid.
      body:
        order.state === 'paid'
          ? 'Thank you! Your order is confirmed and we will prepare it.'
          : (stageMessage(order.state, order.fulfilmentMethod) ?? 'You can view your order for the latest updates.'),
      actions: ['view_order', 'continue_shopping'],
    };
  }
  if (order.paymentState === 'under_review') {
    return {
      kind: 'under_review',
      tone: 'warn',
      headline: 'We received your payment',
      body: 'Something about it needs a quick check by our team. You do not need to pay again; we will update this order.',
      actions: ['view_order', 'my_orders'],
    };
  }
  if (order.paymentState === 'refunded') {
    return {
      kind: 'refunded',
      tone: 'info',
      headline: 'Your payment was refunded',
      body: 'The payment for this order has been refunded. If you have any questions, please contact us with your order number.',
      actions: ['view_order', 'continue_shopping'],
    };
  }
  if (order.state === 'cancelled' || order.state === 'expired') {
    return {
      kind: 'closed',
      tone: 'warn',
      headline: order.state === 'expired' ? 'This order expired' : 'This order was cancelled',
      body: 'If you were charged, please contact us with your order number and we will sort it out.',
      actions: ['my_orders', 'continue_shopping'],
    };
  }
  if (order.paymentState === 'failed') {
    return {
      kind: 'failed',
      tone: 'error',
      headline: 'Your payment did not go through',
      body: 'You have not been charged for this order. You can try again.',
      actions: order.canPay ? ['try_again', 'view_order'] : ['view_order', 'my_orders'],
    };
  }
  if (polling === 'timeout') {
    return {
      kind: 'timeout',
      tone: 'warn',
      headline: 'Still waiting for confirmation',
      body: 'We have not received confirmation yet. If you already paid, please do not pay again: check My orders in a few minutes.',
      actions: order.canPay ? ['check_again', 'view_order', 'try_again'] : ['check_again', 'view_order'],
    };
  }
  return {
    kind: 'pending',
    tone: 'info',
    headline: 'Confirming your payment…',
    body: 'This usually takes a few seconds. Please keep this page open.',
    actions: [],
  };
}
