import { formatNaira } from '@/lib/storefront/catalogue';
import {
  ORDER_STATE_LABEL, PAYMENT_STATE_LABEL, TIMELINE_LABEL,
  type CustomerOrder, type OrderState,
} from '@/lib/storefront/orders';

const BADGE: Record<OrderState, string> = {
  awaiting_payment: 'bg-[#fdf6dc] text-[#7a5a0c]',
  paid: 'bg-[#e5f4ea] text-[#0f4f2d]',
  processing: 'bg-[#e8f0fb] text-[#1d4a8a]',
  completed: 'bg-[#e5f4ea] text-[#0f4f2d]',
  cancelled: 'bg-[#efece4] text-[#5d5645]',
  expired: 'bg-[#efece4] text-[#5d5645]',
  under_review: 'bg-[#fdf6dc] text-[#7a5a0c]',
};

export function StateBadge({ state }: { state: OrderState }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${BADGE[state]}`}>{ORDER_STATE_LABEL[state]}</span>;
}

export const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
};

export function OrderItems({ order }: { order: CustomerOrder }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Items in order {order.orderNumber}</caption>
      <thead>
        <tr className="border-b border-[#eadfc8] text-left text-xs uppercase tracking-wide text-[#8b7f6b]">
          <th scope="col" className="py-2 font-semibold">Item</th>
          <th scope="col" className="py-2 text-right font-semibold">Qty</th>
          <th scope="col" className="py-2 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        {order.items.map((i) => (
          <tr key={i.slug} className="border-b border-[#f1e9d6]">
            <td className="py-2.5 pr-2 text-[#1d2a22]">
              {i.name}
              <span className="block text-xs text-[#8b7f6b]">{formatNaira(i.unitPrice)} each</span>
            </td>
            <td className="py-2.5 text-right">{i.quantity}</td>
            <td className="py-2.5 text-right font-semibold">{formatNaira(i.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2} className="pt-3 text-right text-sm font-semibold">Total</th>
          <td className="pt-3 text-right text-lg font-extrabold text-[#0f4f2d]">{formatNaira(order.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function PaymentLine({ order }: { order: CustomerOrder }) {
  return (
    <p className="text-sm text-[#3b3a33]">
      <span className="font-semibold">Payment:</span> {PAYMENT_STATE_LABEL[order.paymentState]}
      {order.paymentReference && <span className="ml-2 text-xs text-[#8b7f6b]">Ref: {order.paymentReference}</span>}
    </p>
  );
}

export function Timeline({ order }: { order: CustomerOrder }) {
  if (order.timeline.length === 0) return null;
  return (
    <ol className="space-y-2 border-l-2 border-[#eadfc8] pl-4" aria-label="Order history">
      {order.timeline.map((t, i) => (
        <li key={`${t.event}-${i}`} className="text-sm">
          <span className="font-medium text-[#1d2a22]">{TIMELINE_LABEL[t.event] ?? 'Update'}</span>
          <span className="ml-2 text-xs text-[#8b7f6b]">{formatWhen(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}
