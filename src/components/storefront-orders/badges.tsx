import {
  ORDER_STATUS_LABEL,
  PAYMENT_RECORD_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderWarning,
} from '@/lib/storefront-orders/format';
import type { AdminOrderStatus, AdminPaymentStatus } from '@/types/storefront-orders';

export const ORDER_STYLES: Record<AdminOrderStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  confirmed: 'bg-sky-50 text-sky-700 border-sky-200',
  processing: 'bg-orange-50 text-orange-700 border-orange-300',
  dispatched: 'bg-blue-50 text-blue-700 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PAYMENT_STYLES: Record<AdminPaymentStatus, string> = {
  unpaid: 'bg-gray-100 text-gray-600 border-gray-200',
  paid: 'bg-[#e8f5ee] text-[#1a7a4a] border-[#b9e0c9]',
  review: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const base = 'inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap';

export function OrderStatusBadge({ status }: { status: AdminOrderStatus }) {
  return <span className={`${base} ${ORDER_STYLES[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function PaymentStatusBadge({ status }: { status: AdminPaymentStatus }) {
  return <span className={`${base} ${PAYMENT_STYLES[status]}`}>{PAYMENT_STATUS_LABEL[status]}</span>;
}

export function WarningChip({ warning }: { warning: OrderWarning }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium whitespace-nowrap">{warning.label}</span>;
}

const RECORD_STYLES: Record<string, string> = {
  initiated: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-[#e8f5ee] text-[#1a7a4a] border-[#b9e0c9]',
  failed: 'bg-red-50 text-red-700 border-red-200',
  quarantined: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function PaymentRecordBadge({ status }: { status: string }) {
  return <span className={`${base} ${RECORD_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>{PAYMENT_RECORD_LABEL[status] ?? status}</span>;
}
