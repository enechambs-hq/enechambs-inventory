/**
 * Admin operational alerts: new paid orders awaiting fulfilment, and (administrators only) orders needing payment
 * review. Pure and framework-free (relative imports only; node:test loads it).
 *
 * The numbers come from the API's `GET /admin/storefront-orders/alerts`, which derives them from the order rows
 * themselves. This module only decides how to present them, where each one links, and WHEN to ask again.
 */
import type { AppError } from '../errors/app-error.ts';

export interface AlertCount {
  count: number;
  /** Set only when exactly one order is behind the count: the link then opens that order directly. */
  orderNumber: string | null;
}

export interface AdminAlerts {
  newPaid: AlertCount;
  /** Null for staff: payment review is an administrator matter and the API does not send it. */
  paymentReview: AlertCount | null;
  generatedAt: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseCount(v: unknown): AlertCount | null {
  if (!isObject(v)) return null;
  const count = Number(v.count);
  if (!Number.isInteger(count) || count < 0) return null;
  const orderNumber = typeof v.orderNumber === 'string' && /^ENE-[A-Z0-9]{8}$/.test(v.orderNumber) ? v.orderNumber : null;
  return { count, orderNumber: count === 1 ? orderNumber : null };
}

/** Field by field: anything unexpected is rejected rather than shown. */
export function parseAlerts(raw: unknown): AdminAlerts | null {
  if (!isObject(raw)) return null;
  const newPaid = parseCount(raw.newPaid);
  if (!newPaid) return null;
  const paymentReview = raw.paymentReview === null || raw.paymentReview === undefined ? null : parseCount(raw.paymentReview);
  if (raw.paymentReview !== null && raw.paymentReview !== undefined && !paymentReview) return null;
  return { newPaid, paymentReview, generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '' };
}

export type AlertKey = 'new-paid' | 'payment-review';

export interface AlertItem {
  key: AlertKey;
  label: string;
  count: number;
  /** The one order when only one is waiting, otherwise the Online Orders list filtered to exactly these orders. */
  href: string;
}

export const ALERT_FILTER_PARAM = 'filter';
export const ALERT_FILTER_NEW_PAID = 'new-paid';
export const ALERT_FILTER_REVIEW = 'review';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Only the alerts that have something in them, in priority order (payment problems first). */
export function alertItems(alerts: AdminAlerts, canReview: boolean): AlertItem[] {
  const items: AlertItem[] = [];
  if (canReview && alerts.paymentReview && alerts.paymentReview.count > 0) {
    const r = alerts.paymentReview;
    items.push({
      key: 'payment-review',
      label: plural(r.count, 'payment to review', 'payments to review'),
      count: r.count,
      href: r.orderNumber ? `/storefront-orders/${r.orderNumber}` : `/storefront-orders?${ALERT_FILTER_PARAM}=${ALERT_FILTER_REVIEW}`,
    });
  }
  if (alerts.newPaid.count > 0) {
    const n = alerts.newPaid;
    items.push({
      key: 'new-paid',
      label: plural(n.count, 'new paid order', 'new paid orders'),
      count: n.count,
      href: n.orderNumber ? `/storefront-orders/${n.orderNumber}` : `/storefront-orders?${ALERT_FILTER_PARAM}=${ALERT_FILTER_NEW_PAID}`,
    });
  }
  return items;
}

/** What the list page starts with when it is opened from an alert link. Anything else means no preset filter. */
export function filtersFromAlertParam(value: string | null | undefined): { awaitingFulfilment: boolean; needsReview: boolean } {
  return {
    awaitingFulfilment: value === ALERT_FILTER_NEW_PAID,
    needsReview: value === ALERT_FILTER_REVIEW,
  };
}

// ── the store: one shared, bounded poller ────────────────────────────────────

export type AlertsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface AlertsState {
  status: AlertsStatus;
  alerts: AdminAlerts | null;
  /** Set while status is 'error'. The last good `alerts` are kept so the badge does not vanish on a blip. */
  error: AppError | null;
  updatedAt: number | null;
}

export interface AlertsStoreOptions {
  fetchAlerts: () => Promise<unknown>;
  /** Maps whatever the fetch threw into the shared error model. */
  toError: (error: unknown) => AppError;
  intervalMs?: number;
  /** A focus or visibility return within this time of the last answer does not ask again. */
  minGapMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const ALERTS_INTERVAL_MS = 60_000;
export const ALERTS_MIN_GAP_MS = 15_000;

/**
 * Polls while (and only while) something is subscribed AND the page is visible. A single request is in flight at a
 * time, however many components subscribe, and a 403/404 (alerts not available to this user, or the online store is
 * off) stops polling for good instead of retrying forever.
 */
export function createAlertsStore(options: AlertsStoreOptions) {
  const interval = options.intervalMs ?? ALERTS_INTERVAL_MS;
  const minGap = options.minGapMs ?? ALERTS_MIN_GAP_MS;
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let state: AlertsState = { status: 'idle', alerts: null, error: null, updatedAt: null };
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let inFlight = false;
  let visible = true;
  let stopped = false; // 403/404: never poll again
  let generation = 0;

  const set = (next: Partial<AlertsState>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const clearPending = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const schedule = () => {
    clearPending();
    if (listeners.size === 0 || !visible || stopped) return;
    timer = setTimer(() => void refresh(), interval);
  };

  async function refresh(): Promise<void> {
    if (inFlight || stopped || listeners.size === 0) return;
    inFlight = true;
    const mine = generation;
    clearPending();
    if (state.status === 'idle') set({ status: 'loading' });
    try {
      const parsed = parseAlerts(await options.fetchAlerts());
      if (mine !== generation) return;
      if (!parsed) throw new Error('unexpected alerts response');
      set({ status: 'ready', alerts: parsed, error: null, updatedAt: now() });
    } catch (e) {
      if (mine !== generation) return;
      const error = options.toError(e);
      if (error.kind === 'forbidden' || error.kind === 'not_found' || error.kind === 'unauthenticated') {
        stopped = true;
        set({ status: 'unavailable', alerts: null, error: null });
      } else {
        set({ status: 'error', error });
      }
    } finally {
      inFlight = false;
      if (mine === generation) schedule();
    }
  }

  return {
    getState: () => state,
    /** Starts polling for the first subscriber and stops it when the last one leaves. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) {
        stopped = false;
        void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          generation += 1; // an answer still on its way is ignored
          clearPending();
          inFlight = false;
          state = { status: 'idle', alerts: null, error: null, updatedAt: null };
        }
      };
    },
    /** Ask now (a person pressed retry, or an order action just changed the numbers). */
    refresh,
    /** The tab was hidden or shown. Hidden: stop the timer. Shown: refresh if the numbers are stale. */
    setVisible(v: boolean) {
      visible = v;
      if (!v) return clearPending();
      if (state.updatedAt === null || now() - state.updatedAt >= minGap) void refresh();
      else schedule();
    },
    /** The window regained focus: same rule as becoming visible. */
    focus() {
      if (!visible || stopped) return;
      if (state.updatedAt === null || now() - state.updatedAt >= minGap) void refresh();
    },
  };
}
