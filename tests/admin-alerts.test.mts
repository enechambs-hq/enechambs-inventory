import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alertItems, createAlertsStore, filtersFromAlertParam, parseAlerts, ALERTS_INTERVAL_MS, ALERTS_MIN_GAP_MS,
} from '../src/lib/storefront-orders/alerts.ts';
import { makeAppError, type AppError } from '../src/lib/errors/app-error.ts';
import { buildOrderListParams, createStorefrontOrdersApi, type HttpClient } from '../src/lib/storefront-orders/orders-api.ts';

const raw = (over: Record<string, unknown> = {}) => ({
  newPaid: { count: 3, orderNumber: null }, paymentReview: { count: 2, orderNumber: null }, generatedAt: '2026-11-09T10:00:00Z', ...over,
});

// ── parsing ───────────────────────────────────────────────────────────────────
test('parses the API shape field by field and rejects anything unexpected', () => {
  assert.deepEqual(parseAlerts(raw())?.newPaid, { count: 3, orderNumber: null });
  assert.equal(parseAlerts(raw({ paymentReview: null }))?.paymentReview, null); // staff
  assert.equal(parseAlerts(null), null);
  assert.equal(parseAlerts({}), null);
  assert.equal(parseAlerts(raw({ newPaid: { count: -1 } })), null);
  assert.equal(parseAlerts(raw({ newPaid: { count: 'x' } })), null);
  assert.equal(parseAlerts(raw({ paymentReview: { count: 1.5 } })), null);
  // an order number only counts when exactly one order is behind it and it looks like one
  assert.equal(parseAlerts(raw({ newPaid: { count: 2, orderNumber: 'ENE-ABCD2345' } }))?.newPaid.orderNumber, null);
  assert.equal(parseAlerts(raw({ newPaid: { count: 1, orderNumber: '../../admin' } }))?.newPaid.orderNumber, null);
  assert.equal(parseAlerts(raw({ newPaid: { count: 1, orderNumber: 'ENE-ABCD2345' } }))?.newPaid.orderNumber, 'ENE-ABCD2345');
});

// ── presentation and navigation ───────────────────────────────────────────────
test('shows only non-empty alerts, payment review first, with counts matching the data', () => {
  const items = alertItems(parseAlerts(raw())!, true);
  assert.deepEqual(items.map((i) => [i.key, i.count, i.label]), [['payment-review', 2, '2 payments to review'], ['new-paid', 3, '3 new paid orders']]);
  assert.deepEqual(alertItems(parseAlerts(raw({ newPaid: { count: 0, orderNumber: null }, paymentReview: { count: 0, orderNumber: null } }))!, true), []);
  assert.equal(alertItems(parseAlerts(raw({ newPaid: { count: 1, orderNumber: 'ENE-ABCD2345' } }))!, true).find((i) => i.key === 'new-paid')?.label, '1 new paid order');
});

test('links go to the filtered list, or straight to the order when only one is waiting', () => {
  const many = alertItems(parseAlerts(raw())!, true);
  assert.equal(many.find((i) => i.key === 'new-paid')!.href, '/storefront-orders?filter=new-paid');
  assert.equal(many.find((i) => i.key === 'payment-review')!.href, '/storefront-orders?filter=review');
  const one = alertItems(parseAlerts(raw({ newPaid: { count: 1, orderNumber: 'ENE-ABCD2345' }, paymentReview: { count: 1, orderNumber: 'ENE-WXYZ2345' } }))!, true);
  assert.equal(one.find((i) => i.key === 'new-paid')!.href, '/storefront-orders/ENE-ABCD2345');
  assert.equal(one.find((i) => i.key === 'payment-review')!.href, '/storefront-orders/ENE-WXYZ2345');
});

test('staff never see payment review, even if a payload carried it', () => {
  const items = alertItems(parseAlerts(raw())!, false);
  assert.deepEqual(items.map((i) => i.key), ['new-paid']);
  assert.deepEqual(alertItems(parseAlerts(raw({ paymentReview: null }))!, true).map((i) => i.key), ['new-paid']);
});

test('the list opens pre-filtered from an alert link and ignores anything else', () => {
  assert.deepEqual(filtersFromAlertParam('new-paid'), { awaitingFulfilment: true, needsReview: false });
  assert.deepEqual(filtersFromAlertParam('review'), { awaitingFulfilment: false, needsReview: true });
  for (const v of [null, undefined, '', 'all', 'NEW-PAID', 'review;drop']) assert.deepEqual(filtersFromAlertParam(v), { awaitingFulfilment: false, needsReview: false });
});

test('the API client asks for the alerts route and the awaiting-fulfilment filter, nothing else', async () => {
  const calls: Array<{ url: string; params?: unknown }> = [];
  const http: HttpClient = {
    get: async (url, config) => (calls.push({ url, params: config?.params }), { data: raw() as never, status: 200 }),
    post: async () => ({ data: {} as never, status: 200 }),
    patch: async () => ({ data: {} as never, status: 200 }),
  };
  await createStorefrontOrdersApi(http).alerts();
  assert.deepEqual(calls[0], { url: '/admin/storefront-orders/alerts', params: undefined });
  assert.deepEqual(buildOrderListParams({ awaitingFulfilment: true }), { page: 1, limit: 10, awaitingFulfilment: true });
  assert.deepEqual(buildOrderListParams({ awaitingFulfilment: false }), { page: 1, limit: 10 });
});

// ── the store: loading, ready, error, refresh behaviour ──────────────────────
function harness(responses: Array<unknown | Error>) {
  let t = 1_000_000;
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  let calls = 0;
  let pendingResolve: (() => void) | null = null;
  const store = createAlertsStore({
    fetchAlerts: async () => {
      calls += 1;
      const next = responses.length > 1 ? responses.shift() : responses[0];
      if (next === 'HANG') await new Promise<void>((r) => { pendingResolve = r; });
      if (next instanceof Error) throw next;
      return next === 'HANG' ? raw() : next;
    },
    toError: (e) => (e as { appError?: AppError }).appError ?? makeAppError({ kind: 'unexpected', message: 'Something went wrong.', retryable: true }),
    now: () => t,
    setTimer: (fn, ms) => { const h = { fn, ms, cleared: false }; timers.push(h); return h; },
    clearTimer: (h) => { (h as { cleared: boolean }).cleared = true; },
  });
  const live = () => timers.filter((x) => !x.cleared);
  const flush = () => new Promise((r) => setImmediate(r));
  return { store, timers, live, flush, calls: () => calls, advance: (ms: number) => { t += ms; }, release: () => pendingResolve?.() };
}
const err = (kind: AppError['kind']) => Object.assign(new Error(kind), { appError: makeAppError({ kind, message: 'x', retryable: kind === 'unexpected' }) });

test('loading then ready, with a poll scheduled at the modest interval', async () => {
  const h = harness([raw()]);
  const states: string[] = [];
  h.store.subscribe(() => states.push(h.store.getState().status));
  await h.flush();
  assert.deepEqual(states, ['loading', 'ready']);
  assert.equal(h.store.getState().alerts?.newPaid.count, 3);
  assert.equal(h.live().length, 1);
  assert.equal(h.live()[0].ms, ALERTS_INTERVAL_MS);
});

test('the poll timer asks again, and only one request is ever in flight', async () => {
  const h = harness(['HANG']);
  h.store.subscribe(() => {});
  h.store.subscribe(() => {}); // a second component shares the same poller
  await h.flush();
  assert.equal(h.calls(), 1);
  void h.store.refresh(); void h.store.refresh();
  assert.equal(h.calls(), 1, 'refresh while a request is in flight is ignored');
  h.release(); await h.flush();
  assert.equal(h.calls(), 1);
  h.live()[0].fn(); await h.flush(); // the timer fires
  assert.equal(h.calls(), 2);
});

test('an error keeps the last good counts, reports the shared error, and polling continues; retry recovers', async () => {
  const h = harness([raw(), err('unexpected'), raw({ newPaid: { count: 5, orderNumber: null } })]);
  h.store.subscribe(() => {});
  await h.flush();
  h.live()[0].fn(); await h.flush();
  const s = h.store.getState();
  assert.equal(s.status, 'error');
  assert.equal(s.error?.kind, 'unexpected');
  assert.equal(s.alerts?.newPaid.count, 3); // not blanked by a blip
  assert.equal(h.live().length, 1); // still scheduled
  await h.store.refresh();
  assert.equal(h.store.getState().status, 'ready');
  assert.equal(h.store.getState().alerts?.newPaid.count, 5);
  assert.equal(h.store.getState().error, null);
});

test('a malformed response is an error, never displayed', async () => {
  const h = harness([{ newPaid: 'lots' }]);
  h.store.subscribe(() => {});
  await h.flush();
  assert.equal(h.store.getState().status, 'error');
  assert.equal(h.store.getState().alerts, null);
});

test('403/404/401 means not available: nothing shown and polling stops for good', async () => {
  for (const kind of ['forbidden', 'not_found', 'unauthenticated'] as const) {
    const h = harness([err(kind)]);
    h.store.subscribe(() => {});
    await h.flush();
    assert.equal(h.store.getState().status, 'unavailable', kind);
    assert.equal(h.live().length, 0, `${kind}: no timer`);
    await h.store.refresh();
    assert.equal(h.calls(), 1, `${kind}: never asked again`);
  }
});

test('a hidden tab stops polling; coming back refreshes only when the numbers are stale', async () => {
  const h = harness([raw()]);
  h.store.subscribe(() => {});
  await h.flush();
  h.store.setVisible(false);
  assert.equal(h.live().length, 0);
  h.advance(ALERTS_MIN_GAP_MS - 1);
  h.store.setVisible(true);
  await h.flush();
  assert.equal(h.calls(), 1, 'fresh enough: no request');
  assert.equal(h.live().length, 1, 'but the timer is back');
  h.store.setVisible(false);
  h.advance(ALERTS_MIN_GAP_MS + 1);
  h.store.setVisible(true);
  await h.flush();
  assert.equal(h.calls(), 2, 'stale: refreshed on return');
});

test('window focus refreshes only stale numbers, and never while hidden', async () => {
  const h = harness([raw()]);
  h.store.subscribe(() => {});
  await h.flush();
  h.store.focus(); await h.flush();
  assert.equal(h.calls(), 1);
  h.advance(ALERTS_MIN_GAP_MS + 1);
  h.store.setVisible(false);
  h.store.focus(); await h.flush();
  assert.equal(h.calls(), 1, 'hidden: no request');
  h.store.setVisible(true); await h.flush();
  assert.equal(h.calls(), 2);
});

test('when the last subscriber leaves, polling stops and a late answer is ignored', async () => {
  const h = harness(['HANG']);
  const off = h.store.subscribe(() => {});
  await h.flush();
  off();
  assert.equal(h.live().length, 0);
  h.release(); await h.flush();
  assert.equal(h.store.getState().status, 'idle');
  assert.equal(h.live().length, 0, 'no timer after leaving');
  // subscribing again starts cleanly
  h.store.subscribe(() => {});
  await h.flush();
  assert.equal(h.calls(), 2);
});

test('refresh with nobody subscribed does nothing (no background requests once the admin interface is gone)', async () => {
  const h = harness([raw()]);
  await h.store.refresh();
  assert.equal(h.calls(), 0);
});
