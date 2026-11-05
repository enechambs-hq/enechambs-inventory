/**
 * Staff and administrator screens, end to end, against the real API:
 * Online Orders (list, filters, pagination, loading/error states), order
 * details, fulfilment, admin-only reconciliation, Online Reports, role-based
 * access, notification emails, and the customer's own view of the same orders.
 *
 * Orders in every state (paid, awaiting payment, late payment, duplicate charge,
 * amount mismatch, processing) are created through the real API with a SCRIPTED
 * payment provider; nothing contacts Flutterwave or sends mail.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ctl, orderFact, stockOf, type MailFact, type Seed, type StaffTokens } from './support/control';
import { customerContext, eq, lagosToday, ok, staffContext } from './support/helpers';

test.describe.configure({ mode: 'serial' });

const rowOf = (p: Page, orderNumber: string) => p.locator('tbody tr', { has: p.locator(`a:text-is("${orderNumber}")`) });
const rowCount = (p: Page) => p.locator('tbody tr a[href^="/storefront-orders/"]').count();
async function openList(p: Page): Promise<void> {
  await p.goto('/storefront-orders');
  await p.waitForSelector('table');
  await expect(p.locator('tbody tr a[href^="/storefront-orders/"]').first()).toBeVisible();
}
/** A hand-made API call from the page, exactly as someone bypassing the UI would make it. */
async function apiCall(p: Page, token: string, method: string, path: string, body?: unknown): Promise<number> {
  return p.evaluate(async ([t, m, u, b]) => {
    const r = await fetch(u as string, { method: m as string, headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined });
    return r.status;
  }, [token, method, `/api/v1${path}`, body]);
}
const kpi = async (p: Page, label: string): Promise<string> =>
  ((await p.locator('div', { has: p.locator(`p:text-is("${label}")`) }).filter({ has: p.locator('p.text-2xl') }).last().locator('p.text-2xl').innerText()) ?? '').trim();

test.describe('staff and admin: online orders and reports', () => {
  let tokens: StaffTokens;
  let seed: Seed;
  let S: Seed['orders'];
  let admin: BrowserContext;
  let A: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    tokens = await ctl<StaffTokens>('/tokens');
    await ctl('/reset');
    seed = await ctl<Seed>('/seed');
    S = seed.orders;
    await ctl('/bulk-orders?n=12'); // 7 seeded + 12 = 19 orders, for pagination
    admin = await staffContext(browser, 'admin', tokens);
    A = await admin.newPage();
  });
  test.afterAll(async () => admin.close());

  // ───────────── navigation and role-based access ─────────────
  test('NAV: admins see Online Orders and Online Reports; staff see only Online Orders; in-store Sales stays separate', async ({ browser }) => {
    await A.goto('/storefront-orders');
    await A.waitForSelector('nav a[href="/storefront-orders"]');
    expect(await A.locator('nav a[href="/storefront-reports"]').count()).toBe(1);
    await expect(A.locator('nav a[href="/storefront-orders"]')).toHaveText('Online Orders');
    expect(await A.locator('nav a[href="/sales"]').count()).toBe(1);
    const sctx = await staffContext(browser, 'staff', tokens);
    const P = await sctx.newPage();
    await P.goto('/storefront-orders');
    await P.waitForSelector('nav a[href="/storefront-orders"]');
    eq(await P.locator('nav a[href="/storefront-reports"]').count(), 0, 'staff have no Online Reports link');
    await sctx.close();
  });

  // ───────────── list ─────────────
  test('LIST: every seeded order is listed with customer, email, items, total, payment and status', async () => {
    await openList(A);
    const row = rowOf(A, S.paid);
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    ok(/Ada Obi/.test(text) && /@seed\.test/.test(text), `customer name and email: ${text}`);
    ok(/₦30,000/.test(text), 'total');
    ok(/\bPaid\b/.test(text) && /Confirmed/.test(text), `badges: ${text}`);
    await expect(row.getByTestId('item-count')).toHaveText('2 items');
  });

  test('LIST: warning chips and the payment deadline appear where they apply', async () => {
    const late = (await rowOf(A, S.late).innerText()).replace(/\s+/g, ' ');
    ok(/Late payment/.test(late) && /Needs review/.test(late), `late: ${late}`);
    ok(/Duplicate charge/.test(await rowOf(A, S.duplicate).innerText()), 'duplicate chip');
    ok(/mismatch/i.test(await rowOf(A, S.mismatch).innerText()), 'mismatch chip');
    const awaiting = (await rowOf(A, S.awaiting).innerText()).replace(/\s+/g, ' ');
    ok(/Awaiting payment/.test(awaiting) && /(Pay by|Overdue since) .*\d{4}, \d{1,2}:\d{2}/.test(awaiting), `deadline shown: ${awaiting}`);
    await expect(rowOf(A, S.paid).getByTestId('pay-by')).toHaveCount(0);
  });

  test('LIST: search by order number, including wildcard characters', async () => {
    await A.fill('#order-search', S.paid.slice(4, 10));
    await expect.poll(() => rowCount(A)).toBe(1);
    await A.fill('#order-search', "%_'; --");
    await A.waitForSelector('text=No orders match these filters.');
    await A.fill('#order-search', '');
    await expect.poll(() => rowCount(A)).toBeGreaterThanOrEqual(7);
  });

  test('LIST: payment-status and order-status filters', async () => {
    await A.selectOption('#payment-status', 'review');
    await expect.poll(() => rowCount(A)).toBe(3);
    const t = await A.locator('tbody').innerText();
    ok([S.late, S.lateForRefund, S.mismatch].every((n) => t.includes(n)), 'the three review orders');
    await A.selectOption('#payment-status', '');
    await A.selectOption('#order-status', 'processing');
    await expect.poll(() => rowCount(A)).toBe(1);
    ok((await A.locator('tbody').innerText()).includes(S.processing), 'the processing order');
    await A.selectOption('#order-status', '');
  });

  test('LIST: needs-review toggle and Lagos date range, with a clear empty state', async () => {
    await A.check('text=Needs review >> input[type=checkbox]');
    await expect.poll(() => rowCount(A)).toBe(4); // late, lateForRefund, mismatch, duplicate
    await A.uncheck('text=Needs review >> input[type=checkbox]');
    await A.fill('#from-date', '2020-01-01');
    await A.fill('#to-date', '2020-01-31');
    await A.waitForSelector('text=No orders match these filters.');
    await A.locator('text=Clear filters').last().click();
    await expect.poll(() => rowCount(A)).toBeGreaterThanOrEqual(7);
    await A.fill('#from-date', lagosToday());
    await A.fill('#to-date', lagosToday());
    await expect.poll(() => rowCount(A)).toBeGreaterThanOrEqual(7);
    await A.locator('text=Clear filters').last().click();
  });

  test('LIST: pagination (19 orders, 10 per page)', async () => {
    await expect.poll(() => rowCount(A)).toBe(10);
    await expect(A.locator('text=Page 1 of 2')).toBeVisible();
    await expect(A.locator('button:has-text("Previous")')).toBeDisabled();
    await A.click('button:has-text("Next")');
    await A.waitForSelector('text=Page 2 of 2');
    await expect.poll(() => rowCount(A)).toBe(9);
    await expect(A.locator('button:has-text("Next")')).toBeDisabled();
  });

  test('LIST: a loading skeleton while waiting, and an error state that recovers', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await A.route('**/api/v1/admin/storefront-orders?**', async (route) => { await gate; await route.continue(); });
    const navigation = A.goto('/storefront-orders');
    await A.waitForSelector('[aria-busy="true"]');
    expect(await A.locator('.animate-pulse').count()).toBeGreaterThan(0);
    release();
    await navigation;
    await A.unroute('**/api/v1/admin/storefront-orders?**');
    await A.route('**/api/v1/admin/storefront-orders?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await A.goto('/storefront-orders');
    await A.waitForSelector('text=Could not load online orders');
    await A.unroute('**/api/v1/admin/storefront-orders?**');
    await A.click('button:has-text("Try again")');
    await expect.poll(() => rowCount(A)).toBeGreaterThanOrEqual(7);
  });

  // ───────────── detail ─────────────
  test('DETAIL: customer, price-snapshot lines, verified payment, expiry and stock info, timeline', async () => {
    await A.goto(`/storefront-orders/${S.paid}`);
    await A.waitForSelector('[data-testid="order-number"]');
    const body = (await A.innerText('body')).replace(/\s+/g, ' ');
    ok(/Ada Obi/.test(body) && /@seed\.test/.test(body), 'customer');
    ok(/Jollof Feast/.test(body) && /₦15,000/.test(body) && /₦30,000/.test(body), 'line snapshot');
    ok(/Verified with Flutterwave: ₦30,000 NGN/.test(body), 'verification text');
    ok(/order timing/i.test(body) && /pay by/i.test(body) && /Reserved for this order/.test(body), 'timing and stock');
    ok(/Payment verified and confirmed/.test(body) && /Order placed/.test(body), 'timeline');
    await expect(A.getByTestId('order-total')).toHaveText('₦30,000');
  });

  test('DETAIL: an unknown order shows a clear error, not a blank page', async () => {
    await A.goto('/storefront-orders/ENE-NOPE0000');
    await A.waitForSelector('text=This order does not exist.');
  });

  // ───────────── staff: fulfilment yes, money no ─────────────
  test.describe('as ordinary staff', () => {
    let sctx: BrowserContext;
    let P: Page;
    test.beforeAll(async ({ browser }) => { sctx = await staffContext(browser, 'staff', tokens); P = await sctx.newPage(); });
    test.afterAll(async () => sctx.close());

    test('STAFF: can advance a PAID order, and the UI shows what the BACKEND says', async () => {
      await P.goto(`/storefront-orders/${S.paid}`);
      await P.waitForSelector('[data-testid="order-number"]');
      await expect(P.locator('button:has-text("Start processing")')).toBeVisible();
      await expect(P.locator('button:has-text("Mark completed")')).toBeVisible();
      eq((await P.locator('button:has-text("Honour")').count()) + (await P.locator('button:has-text("refund")').count()), 0, 'no financial buttons for staff');
      await P.click('button:has-text("Start processing")');
      await P.click('[role=dialog] button:has-text("Confirm")');
      await P.waitForSelector('text=Order moved to processing.');
      await P.waitForSelector('span:text-is("Processing")');
      eq((await orderFact(S.paid)).status, 'processing', 'database');
      await expect(P.locator('button:has-text("Start processing")')).toHaveCount(0);
    });

    test('STAFF: cannot fulfil an unpaid order, and is told why', async () => {
      await P.goto(`/storefront-orders/${S.awaiting}`);
      await P.waitForSelector('[data-testid="order-number"]');
      await expect(P.locator('button:has-text("Start processing")')).toHaveCount(0);
      await expect(P.locator('text=Staff cannot mark an order paid')).toBeVisible();
    });

    test('STAFF: sees a flagged order but cannot decide it, and the API refuses a hand-made request (403)', async () => {
      await P.goto(`/storefront-orders/${S.late}`);
      await P.waitForSelector('[data-testid="order-number"]');
      await expect(P.locator('text=Only an administrator can decide this')).toBeVisible();
      await expect(P.locator('button:has-text("Honour late payment")')).toHaveCount(0);
      await expect(P.locator('button:has-text("Record refund decision")')).toHaveCount(0);
      const paymentId = await P.evaluate(async (t) => (await (await fetch(`/api/v1/admin/storefront-orders/${location.pathname.split('/').pop()}`, { headers: { authorization: `Bearer ${t}` } })).json()).payments[0].id as string, tokens.staff.token);
      const before = await orderFact(S.late);
      eq(await apiCall(P, tokens.staff.token, 'POST', `/admin/storefront-orders/${S.late}/honour-late-payment`, { note: 'staff trying' }), 403, 'honour as staff');
      eq(await apiCall(P, tokens.staff.token, 'POST', `/admin/storefront-orders/${S.late}/payments/${paymentId}/record-refund`, { note: 'staff trying' }), 403, 'refund as staff');
      eq(await apiCall(P, tokens.staff.token, 'PATCH', `/admin/storefront-orders/${S.late}/fulfilment`, { status: 'completed' }), 409, 'fulfil a non-paid order as staff');
      eq(await orderFact(S.late), before, 'order unchanged');
    });

    test('STAFF: the Online Reports page is admin-only (no data) and its API is 403', async () => {
      await P.goto('/storefront-reports');
      await P.waitForTimeout(1500);
      ok(/\/storefront-reports|\/inventory/.test(P.url()), `redirected to ${P.url()}`);
      await expect(P.locator('[data-testid="report-period"]')).toHaveCount(0);
      eq(await apiCall(P, tokens.staff.token, 'GET', '/admin/storefront-reports?range=today'), 403, 'report API as staff');
    });
  });

  // ───────────── admin decisions ─────────────
  test('ADMIN: honouring a late payment needs a written reason, then re-reserves stock and confirms the order', async () => {
    const stockBefore = await stockOf('party-pack');
    await A.goto(`/storefront-orders/${S.late}`);
    await A.waitForSelector('[data-testid="order-number"]');
    await A.click('button:has-text("Honour late payment")');
    const confirm = A.locator('[role=dialog] button:has-text("Honour payment")');
    await expect(confirm).toBeDisabled();
    await A.fill('#decision-reason', 'ok');
    await expect(confirm).toBeDisabled(); // two characters are not a reason
    await A.fill('#decision-reason', 'Stock confirmed by phone with the customer');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await A.waitForSelector('text=Late payment honoured. The order is confirmed.');
    const o = await orderFact(S.late);
    eq([o.status, o.paymentStatus, o.restored], ['confirmed', 'paid', false], 'database state');
    eq(await stockOf('party-pack'), stockBefore - 2, 'stock re-reserved for 2 units');
    await expect(A.locator('span:text-is("Confirmed")')).toBeVisible();
    await expect(A.locator('button:has-text("Honour late payment")')).toHaveCount(0);
  });

  test("ADMIN: a refund decision keeps the original capture date and is audited with the admin's identity", async () => {
    const before = (await ctl<Array<{ orderNumber: string; capturedAt: string; refundedAt: string | null; status: string }>>('/payments')).find((p) => p.orderNumber === S.lateForRefund)!;
    await A.goto(`/storefront-orders/${S.lateForRefund}`);
    await A.waitForSelector('[data-testid="order-number"]');
    await A.click('button:has-text("Record refund decision")');
    await A.fill('#decision-reason', 'Customer withdrew the order');
    await A.click('[role=dialog] button:has-text("Record refund")');
    await A.waitForSelector('text=Refund decision recorded.');
    const after = (await ctl<Array<{ orderNumber: string; capturedAt: string; refundedAt: string | null; status: string }>>('/payments')).find((p) => p.orderNumber === S.lateForRefund)!;
    eq(after.status, 'refunded', 'payment refunded');
    eq(after.capturedAt, before.capturedAt, 'capture date untouched');
    ok(after.refundedAt && new Date(after.refundedAt) >= new Date(after.capturedAt), 'refund date set');
    const audit = await ctl<Array<{ email: string; action: string; description: string }>>('/audit');
    ok(audit.some((a) => a.email === 'admin@promo.test' && a.action === 'storefront_refund_recorded' && a.description.includes(S.lateForRefund)), 'audit row names the admin');
    ok(audit.some((a) => a.email === 'admin@promo.test' && a.action === 'storefront_order_honoured'), 'honour audited');
  });

  test('ADMIN: a duplicate charge is reconciled by a refund decision on the extra payment', async () => {
    await A.goto(`/storefront-orders/${S.duplicate}`);
    await A.waitForSelector('[data-testid="order-number"]');
    await expect(A.getByTestId('payment-record')).toHaveCount(2);
    await A.getByTestId('payment-record').filter({ hasText: 'Duplicate charge' }).locator('button:has-text("Record refund decision")').click();
    await A.fill('#decision-reason', 'Charged twice, refunding the second charge');
    await A.click('[role=dialog] button:has-text("Record refund")');
    await A.waitForSelector('text=Refund decision recorded.');
    const dup = await orderFact(S.duplicate);
    eq([dup.status, dup.paymentStatus, dup.reviewReason], ['confirmed', 'paid', null], 'order stays paid, review cleared');
  });

  test('ADMIN: no honour action is offered for an amount mismatch', async () => {
    await A.goto(`/storefront-orders/${S.mismatch}`);
    await A.waitForSelector('[data-testid="order-number"]');
    await expect(A.locator('button:has-text("Honour late payment")')).toHaveCount(0);
  });

  // ───────────── reports ─────────────
  test('REPORT: KPIs come from the verified payment records (gross, refunds, net, review, pending, duplicates)', async () => {
    await A.goto('/storefront-reports');
    await A.waitForSelector('[data-testid="report-period"]');
    await A.click('button:has-text("This month")');
    await expect.poll(() => kpi(A, 'Gross collections')).toBe('₦210,100'); // 30000+50000+15000+100(verified)+45000+45000+25000
    eq(await kpi(A, 'Total refunds'), '₦60,000', 'refunds'); // 15000 + 45000
    eq(await kpi(A, 'Net collections'), '₦150,100', 'net');
    eq(await kpi(A, 'Needs review'), '1', 'needs review (only the mismatch is still open)');
    eq(await kpi(A, 'Pending payments'), '1', 'pending');
    eq(await kpi(A, 'Failed payments'), '0', 'failed');
    eq(await kpi(A, 'Duplicate charges'), '1', 'duplicate');
    eq(await kpi(A, 'Paid / completed orders'), '4 / 0', 'paid and completed orders');
    await expect(A.locator('.recharts-surface').first()).toBeVisible();
    const warnings = await A.locator('section:has(h2:text-is("Reconciliation warnings"))').innerText();
    ok(warnings.includes(S.mismatch) && !warnings.includes(S.late), 'only the unresolved mismatch is listed');
    ok((await A.locator('section:has(h2:text-is("Recent successful transactions"))').innerText()).includes(S.paid), 'recent transactions');
  });

  test('REPORT: period selector (previous month is empty, custom validation and apply)', async () => {
    await A.click('button:has-text("Previous month")');
    await A.waitForSelector('[data-testid="no-activity"]');
    eq(await kpi(A, 'Gross collections'), '₦0', 'previous month gross');
    eq(await kpi(A, 'Needs review'), '1', 'an open review item stays visible whatever the period');
    await A.click('button:has-text("Today")');
    await expect(A.getByTestId('no-activity')).toHaveCount(0);
    eq(await kpi(A, 'Gross collections'), '₦210,100', 'today gross');
    await A.click('button:has-text("Custom range")');
    await A.fill('#rep-from', '2026-11-10');
    await A.fill('#rep-to', '2026-11-01');
    await A.click('button:has-text("Apply")');
    await A.waitForSelector('text=The start date is after the end date.');
    await A.fill('#rep-from', lagosToday());
    await A.fill('#rep-to', lagosToday());
    await A.click('button:has-text("Apply")');
    await expect(A.getByTestId('report-period')).toContainText(lagosToday());
    eq(await kpi(A, 'Gross collections'), '₦210,100', 'custom single day');
  });

  test('REPORT: an error state that recovers', async () => {
    await A.route('**/api/v1/admin/storefront-reports?**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await A.goto('/storefront-reports');
    await A.waitForSelector('text=Could not load the report');
    await A.unroute('**/api/v1/admin/storefront-reports?**');
    await A.click('button:has-text("Try again")');
    await A.waitForSelector('[data-testid="report-period"]');
  });

  // ───────────── notifications ─────────────
  test('EMAIL: each state change produced exactly one correctly addressed email, with no admin notes', async () => {
    const counts = await ctl<{ sent: number }>('/notify');
    ok(counts.sent > 0, `the worker sent mail: ${JSON.stringify(counts)}`);
    const mails = await ctl<MailFact[]>('/mails');
    const bySubject = (re: RegExp) => mails.filter((m) => re.test(m.subject));
    eq(bySubject(new RegExp(`Payment received for order ${S.paid}`)).length, 1, 'payment received for the paid order');
    eq(bySubject(new RegExp(`Your order ${S.paid} is being prepared`)).length, 1, 'processing update');
    eq(bySubject(new RegExp(`Refund update for order ${S.lateForRefund}`)).length, 1, 'refund email');
    eq(bySubject(new RegExp(`Refund update for order ${S.duplicate}`)).length, 1, 'duplicate refund email');
    eq(bySubject(new RegExp(`Payment received for order ${S.late}`)).length, 1, 'honoured payment email');
    ok(/₦15,000/.test(bySubject(new RegExp(`Refund update for order ${S.lateForRefund}`))[0].html), 'refund amount');
    ok(!/withdrew|Charged twice|Stock confirmed by phone/.test(mails.map((m) => m.html).join('')), 'internal notes are never emailed');
    ok(mails.every((m) => /@seed\.test$/.test(m.to)), 'only the customers are addressed');
    const keys = mails.map((m) => m.key);
    eq(new Set(keys).size, keys.length, 'no duplicate idempotency keys');
    eq((await ctl<{ sent: number }>('/notify')).sent, 0, 'a second run sends nothing more');
  });

  // ───────────── customers versus staff ─────────────
  test('SEPARATION: a customer session cannot open staff pages or staff APIs', async ({ browser }) => {
    const cctx = await browser.newContext();
    await cctx.addCookies([{ name: 'ene_cust', value: seed.adaToken, domain: 'localhost', path: '/', httpOnly: true }]);
    const C = await cctx.newPage();
    for (const path of ['/storefront-orders', `/storefront-orders/${S.paid}`, '/storefront-reports']) {
      await C.goto(path);
      await C.waitForURL('**/login');
    }
    await C.goto('/combos');
    eq(await apiCall(C, seed.adaToken, 'GET', '/admin/storefront-orders'), 401, 'customer token on the staff list');
    eq(await apiCall(C, seed.adaToken, 'GET', '/admin/storefront-reports?range=today'), 401, 'customer token on reports');
    await cctx.close();
  });

  test("CUSTOMER VIEW: states match what staff decided, and Customer A cannot open Customer B's order", async ({ browser }) => {
    const cctx = await customerContext(browser);
    await cctx.addCookies([{ name: 'ene_cust', value: seed.adaToken, domain: 'localhost', path: '/', httpOnly: true }]);
    const C = await cctx.newPage();
    await C.goto(`/my-orders/${S.paid}`);
    await C.waitForSelector('text=Being prepared');
    await C.goto(`/my-orders/${S.late}`);
    await C.waitForSelector('[data-testid="order-number"]');
    await expect(C.locator('text=Order confirmed after review').first()).toBeVisible();
    await expect(C.locator('span:text-is("Paid")').first()).toBeVisible();
    await C.goto(`/my-orders/${S.awaiting}`); // Bola's order
    await C.waitForSelector('text=We could not find that order');
    ok(!/providerTransactionId|resolutionNote|reviewReason|customerId/.test(await C.content()), 'no internals');
    await cctx.close();
  });
});
