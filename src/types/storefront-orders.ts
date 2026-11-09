/**
 * Staff-side storefront order and report shapes. They mirror the backend's
 * `admin/storefront-orders` and `admin/storefront-reports` responses
 * (enechambs-api src/orders/admin-orders.service.ts, storefront-reports.service.ts).
 * Staff-only: nothing here is used by the customer storefront.
 */
export type AdminOrderStatus = 'pending' | 'confirmed' | 'processing' | 'dispatched' | 'completed' | 'cancelled' | 'expired';
export type AdminPaymentStatus = 'unpaid' | 'paid' | 'review' | 'refunded' | 'failed';
export type ReviewReason = 'late_payment' | 'duplicate_charge' | 'payment_mismatch';
export type PaymentRecordStatus = 'initiated' | 'paid' | 'failed' | 'quarantined' | 'refunded';
export type PaymentReconciliation = 'duplicate_charge' | 'late_payment' | 'amount_mismatch' | 'currency_mismatch';
export type FulfilmentTarget = 'processing' | 'dispatched' | 'completed';

export interface AdminOrderRow {
  orderNumber: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  reviewReason: ReviewReason | null;
  currency: string;
  total: number;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  itemCount: number;
  /** Still holding stock and waiting for payment: the payment deadline applies. */
  awaitingPayment: boolean;
  chargeCount: number;
  /** A cancellation has been requested for this paid order and its refund is not recorded yet. */
  cancellationPending?: boolean;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminOrderListResponse {
  data: AdminOrderRow[];
  meta: ListMeta;
}

export interface AdminOrderItem {
  comboSlug: string;
  comboName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminPayment {
  id: string;
  txRef: string;
  providerTransactionId: string | null;
  status: PaymentRecordStatus;
  reconciliation: PaymentReconciliation | null;
  amount: number;
  currency: string;
  verifiedAmount: number | null;
  verifiedCurrency: string | null;
  capturedAt: string | null;
  refundedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  /** The Flutterwave refund reference recorded for a cancellation refund. */
  refundReference?: string | null;
  refundedBy?: string | null;
}

export interface AdminHistoryEntry {
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorType: 'customer' | 'system' | 'staff';
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface AdminPaymentEvent {
  source: 'webhook' | 'refresh' | 'admin';
  eventType: string | null;
  outcome: string;
  createdAt: string;
  txRef: string;
}

/** requested = refund not started; refund_started = manual refund under way (no withdrawal); completed = finalised. */
export type CancellationState = 'none' | 'requested' | 'refund_started' | 'completed';

export interface CancellationActor {
  id: string;
  name: string | null;
}

/**
 * Paid-order cancellation (manual full refund). The backend decides every flag:
 * the screen offers exactly what it says and nothing more.
 */
export interface AdminCancellation {
  state: CancellationState;
  refundStartedAt?: string | null;
  refundStartedBy?: CancellationActor | null;
  requestedAt: string | null;
  reason: string | null;
  requestedBy: CancellationActor | null;
  /** The full amount to refund, derived from the captured payment (never typed in). */
  refundAmount: number | null;
  refund: { paymentId: string; reference: string; refundedAt: string; refundedBy: CancellationActor | null } | null;
  canRequest: boolean;
  canWithdraw: boolean;
  canStartRefund: boolean;
  canRecordRefund: boolean;
  canRecordFailedRefund: boolean;
  blockedReason: string | null;
}

export interface AdminOrderDetail {
  orderNumber: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  reviewReason: ReviewReason | null;
  currency: string;
  subtotal: number;
  total: number;
  expiresAt: string;
  stockRestoredAt: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: { name: string; phone: string; email: string | null };
  fulfilment: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    note?: string;
    /** Absent on orders placed before delivery existed. */
    method?: 'delivery' | 'pickup';
    deliveryFee?: number;
    address?: { recipientName: string; recipientPhone: string; addressLine: string; city: string; state?: string };
    pickup?: { address: string; hours: string };
  };
  items: AdminOrderItem[];
  payments: AdminPayment[];
  history: AdminHistoryEntry[];
  paymentEvents: AdminPaymentEvent[];
  /** Absent from an older API; treated as no cancellation. */
  cancellation?: AdminCancellation;
}

export interface AdminOrderFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminOrderStatus | '';
  paymentStatus?: AdminPaymentStatus | '';
  needsReview?: boolean;
  /** Only paid orders still awaiting fulfilment (the "new paid orders" alert). */
  awaitingFulfilment?: boolean;
  /** Lagos calendar days, YYYY-MM-DD, both inclusive. */
  fromDate?: string;
  toDate?: string;
}

// ── reports ──────────────────────────────────────────────────────────────────
export type ReportRange = 'today' | 'last7' | 'this_month' | 'previous_month' | 'custom';

export interface CountAmount {
  count: number;
  amount: number;
}

export interface StorefrontReport {
  currency: string;
  timeZone: string;
  period: { from: string; to: string };
  summary: {
    grossCollections: number;
    refunds: number;
    netCollections: number;
    capturedPayments: number;
    refundedPayments: number;
    pendingPayments: CountAmount & { orders: number };
    failedPayments: CountAmount;
    duplicateCharges: CountAmount;
    needsReview: CountAmount & { byReason: Array<CountAmount & { reason: string }> };
    paidOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    expiredOrders: number;
  };
  trend: Array<{ day: string; gross: number; refunds: number; net: number }>;
  paymentsByStatus: Array<CountAmount & { status: string }>;
  recentSuccessful: Array<{
    orderNumber: string;
    amount: number;
    capturedAt: string;
    status: string;
    reconciliation: string | null;
  }>;
  reconciliationWarnings: Array<{
    orderNumber: string;
    reason: string;
    paymentStatus: string;
    orderTotal: number;
    collected: number;
    createdAt: string;
  }>;
  definitions: Record<string, string>;
}

/** One online customer as the admin list returns it (money as numbers after normalising). */
export interface AdminCustomerRow {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  joinedAt: string;
  lastLoginAt: string | null;
  orderCount: number;
  paidOrderCount: number;
  totalPaid: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerListResponse {
  data: AdminCustomerRow[];
  meta: ListMeta;
}
