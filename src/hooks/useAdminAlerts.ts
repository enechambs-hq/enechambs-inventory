'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { appErrorFromStaff } from '@/lib/errors/staff-adapter';
import { createAlertsStore, type AlertsState } from '@/lib/storefront-orders/alerts';
import { storefrontOrdersService } from '@/lib/services/storefront-orders.service';

/**
 * ONE shared store for the whole admin interface: the header and the Online Orders strip both read it, so there is
 * a single poller and a single request in flight however many components show alerts. It polls only while a component
 * is subscribed and the tab is visible (see createAlertsStore).
 */
let store: ReturnType<typeof createAlertsStore> | null = null;
const getStore = () =>
  (store ??= createAlertsStore({
    fetchAlerts: () => storefrontOrdersService.alerts(),
    toError: (e) => appErrorFromStaff(e, { method: 'GET', what: 'alerts' }),
  }));

const IDLE: AlertsState = { status: 'idle', alerts: null, error: null, updatedAt: null };

/** After an order action changes the numbers (fulfilment, a refund, a decision). A no-op when nothing is subscribed. */
export function refreshAdminAlerts(): void {
  if (store) void store.refresh();
}

export function useAdminAlerts(enabled: boolean): AlertsState & { retry: () => void } {
  const s = getStore();
  // Stable between renders: a new function each render would make React unsubscribe and resubscribe every time,
  // and the last unsubscribe resets the store (which would loop).
  const subscribe = useCallback((listener: () => void) => (enabled ? s.subscribe(listener) : () => {}), [enabled, s]);
  const state = useSyncExternalStore(subscribe, () => (enabled ? s.getState() : IDLE), () => IDLE);
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => s.setVisible(document.visibilityState === 'visible');
    const onFocus = () => s.focus();
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, s]);
  return { ...state, retry: () => void s.refresh() };
}
