import { Store, Truck } from 'lucide-react';
import { formatNaira } from '@/lib/storefront/catalogue';
import {
  orderStateLabel, PAYMENT_STATE_LABEL, timelineLabel,
  type CustomerOrder, type FulfilmentMethod, type OrderState,
} from '@/lib/storefront/orders';

const BADGE: Record<OrderState, string> = {
  awaiting_payment: 'bg-[#fdf6dc] text-[#7a5a0c]',
  paid: 'bg-[#e0f2fb] text-[#0b5373]',
  processing: 'bg-[#ffecd6] text-[#9a4a05]',
  dispatched: 'bg-[#dbe8ff] text-[#1d4ed8]',
  completed: 'bg-[#cdeedb] text-[#0f5c30]',
  cancelled: 'bg-[#efece4] text-[#5d5645]',
  expired: 'bg-[#efece4] text-[#5d5645]',
  under_review: 'bg-[#fdf6dc] text-[#7a5a0c]',
};

export function StateBadge({ state, method }: { state: OrderState; method?: FulfilmentMethod | null }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${BADGE[state]}`}>{orderStateLabel(state, method)}</span>;
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
        {order.fulfilment.method === 'delivery' && order.fulfilment.deliveryFee > 0 && (
          <>
            <tr>
              <th scope="row" colSpan={2} className="pt-3 text-right text-sm font-normal text-[#5d5645]">Items</th>
              <td className="pt-3 text-right text-sm">{formatNaira(order.subtotal)}</td>
            </tr>
            <tr>
              <th scope="row" colSpan={2} className="pt-1 text-right text-sm font-normal text-[#5d5645]">Delivery</th>
              <td className="pt-1 text-right text-sm">{formatNaira(order.fulfilment.deliveryFee)}</td>
            </tr>
          </>
        )}
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
          <span className="font-medium text-[#1d2a22]">{timelineLabel(t.event, order.fulfilmentMethod)}</span>
          <span className="ml-2 text-xs text-[#8b7f6b]">{formatWhen(t.at)}</span>
        </li>
      ))}
    </ol>
  );
}

/** How this order is received: the address it is going to, or where to collect it. */
export function FulfilmentSummary({ order }: { order: CustomerOrder }) {
  const f = order.fulfilment;
  if (f.method === 'delivery' && f.address) {
    return (
      <div className="flex items-start gap-2 text-sm text-[#3b3a33]">
        <Truck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#0f4f2d]" />
        <div>
          <p className="font-semibold text-[#0f4f2d]">Delivery to {f.address.recipientName}</p>
          <p>{[f.address.addressLine, f.address.city, f.address.state].filter(Boolean).join(', ')}</p>
          <p className="text-xs text-[#8b7f6b]">{f.address.recipientPhone}</p>
        </div>
      </div>
    );
  }
  if (f.method === 'pickup' && f.pickup) {
    return (
      <div className="flex items-start gap-2 text-sm text-[#3b3a33]">
        <Store size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[#0f4f2d]" />
        <div>
          <p className="font-semibold text-[#0f4f2d]">Pickup</p>
          <p>{f.pickup.address}</p>
          <p className="text-xs text-[#8b7f6b]">Open {f.pickup.hours}</p>
        </div>
      </div>
    );
  }
  return null;
}
