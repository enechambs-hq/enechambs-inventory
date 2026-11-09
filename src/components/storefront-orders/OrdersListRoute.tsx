'use client';

import { useSearchParams } from 'next/navigation';
import OrdersList from './OrdersList';
import { ALERT_FILTER_PARAM, filtersFromAlertParam } from '@/lib/storefront-orders/alerts';

/**
 * Opened from an alert link (?filter=new-paid | review) the list starts with exactly those orders. Keyed by the
 * preset, so following a different alert link while already on the page re-applies it.
 */
export default function OrdersListRoute() {
  const param = useSearchParams().get(ALERT_FILTER_PARAM);
  return <OrdersList key={param ?? 'all'} initial={filtersFromAlertParam(param)} />;
}
