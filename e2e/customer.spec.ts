/**
 * Customer journey, end to end, in a real browser:
 * Browse -> Add to cart -> Register / Sign in -> Checkout -> Create order ->
 * (scripted) Flutterwave payment -> Verified payment return -> My Orders -> Email.
 *
 * Payment is SCRIPTED: the hosted Flutterwave page is stubbed in the browser and
 * the backend's provider is a test double driven through the control server.
 * Nothing here contacts Flutterwave or sends mail.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ctl, orderFact, stockOf, type MailFact } from './support/control';
import { addToCart, customerContext, eq, ok, password, placeOrderAndGetTxRef, register, returnToShop } from './support/helpers';

test.describe.configure({ mode: 'serial' });

test.describe('customer journey', () => {
  let context: BrowserContext;
  let page: Page;
  let email: string;
  let order: string;
  let txRef: string;
  let stock0: { jollof: number; party: number };

  test.beforeAll(async ({ browser }) => {
    await ctl('/reset');
    stock0 = { jollof: await stockOf('jollof-feast'), party: await stockOf('party-pack') };
    email = `guest.${Date.now()}@journey.test`;
    context = await customerContext(browser);
    page = await context.newPage();
  });
  test.afterAll(async () => context.close());

  test('browse: the catalogue lists combos and the detail page has Add to cart', async () => {
    await page.goto('/combos');
    await page.waitForSelector('text=Jollof Feast');
    await page.goto('/combos/jollof-feast');
    await expect(page.locator('button:has-text("Add to cart")')).toBeVisible();
  });

  test('a guest adds to the cart: header count and cart page agree, and the price comes from the server', async () => {
    await page.click('button:has-text("Add to cart")');
    await page.click('button:has-text("Add another")');
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await page.goto('/cart');
    await expect(page.getByTestId('cart-total')).toHaveText('₦30,000');
  });

  test('a guest at checkout is asked to sign in or register, and cannot place the order', async () => {
    await page.click('a:has-text("Checkout")');
    await page.waitForSelector('text=Sign in to continue');
    await expect(page.locator('a:has-text("Create an account")')).toBeVisible();
    await expect(page.locator('button:has-text("Place order and pay")')).toBeDisabled();
  });

  test('registering from checkout returns to /checkout with the guest cart intact and the header signed in', async () => {
    await register(page, email, '/checkout');
    await page.waitForURL('**/checkout');
    await expect(page.getByTestId('checkout-total')).toHaveText('₦30,000');
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    // The header must reflect the new session WITHOUT a reload.
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible();
    await expect(page.locator('header a:has-text("Sign in")')).toHaveCount(0);
  });

  test('the session is an HttpOnly cookie: no token in JavaScript, storage or the page', async () => {
    const cookies = await context.cookies();
    const c = cookies.find((x) => x.name === 'ene_cust');
    ok(c && c.httpOnly && c.sameSite === 'Lax' && c.path === '/', 'ene_cust is HttpOnly, SameSite=Lax');
    ok(!cookies.some((x) => x.name === 'token'), 'no staff token cookie');
    const leaks = await page.evaluate((jwt) => ({
      cookie: document.cookie.includes('ene_cust'),
      ls: JSON.stringify({ ...localStorage }).includes(jwt),
      ss: JSON.stringify({ ...sessionStorage }).includes(jwt),
      dom: document.documentElement.outerHTML.includes(jwt),
    }), (c as { value: string }).value);
    eq(leaks, { cookie: false, ls: false, ss: false, dom: false }, 'token exposure');
  });

  test('placing the order allocates stock, empties the cart and sends the browser to the hosted page', async () => {
    await page.fill('#note', 'No pepper please');
    txRef = await placeOrderAndGetTxRef(page);
    ok(/^ENE-[A-Z0-9]{8}-[0-9a-f]{12}$/.test(txRef), `reference shape: ${txRef}`);
    order = txRef.slice(0, 12);
    eq(await stockOf('jollof-feast'), stock0.jollof - 2, 'stock held');
    ok(!(await page.evaluate(() => localStorage.getItem('ene_cart_v1'))), 'cart emptied once the order exists');
  });

  test('payment-return TAMPER: a URL claiming success does NOT confirm an unpaid order', async () => {
    await returnToShop(page, order, txRef);
    await page.waitForSelector('[data-testid="payment-headline"]');
    await page.waitForTimeout(4500); // at least one refresh round
    expect(((await page.textContent('[data-testid="payment-headline"]')) ?? '').toLowerCase()).not.toContain('confirmed');
    eq((await orderFact(order)).paymentStatus, 'unpaid', 'database still unpaid');
  });

  test('VERIFY: once the provider reports success, the return page confirms the order', async () => {
    await ctl('/pay', { txRef, mode: 'success', webhook: false });
    await returnToShop(page, order, txRef);
    await expect(page.getByTestId('payment-headline')).toContainText(/confirmed/i, { timeout: 20_000 });
    await expect(page.getByTestId('order-number')).toHaveText(`Order ${order}`);
    const o = await orderFact(order);
    eq([o.status, o.paymentStatus], ['confirmed', 'paid'], 'database');
    eq(await stockOf('jollof-feast'), stock0.jollof - 2, 'stock stays consumed');
  });

  test('My Orders: list and detail show the paid order and its history, and expose no internals', async () => {
    await page.goto('/my-orders');
    await page.click(`a:has-text("${order}")`);
    await page.waitForSelector('text=Payment confirmed');
    await expect(page.locator('text=No pepper please')).toBeVisible();
    await expect(page.locator('button:has-text("Pay now")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Cancel order")')).toHaveCount(0);
    ok(!/customerId|providerTransactionId|stockRestoredAt|reviewReason/.test(await page.content()), 'no internals in the page');
  });

  test('signing out keeps a guest cart and signing in preserves it', async () => {
    await addToCart(page, 'party-pack', 1);
    await page.click('button:has-text("Sign out")');
    await page.waitForSelector('a:has-text("Sign in")');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await page.goto(`/account/login?next=${encodeURIComponent('/checkout')}`);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/checkout');
    await expect(page.getByTestId('checkout-total')).toHaveText('₦25,000');
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible();
  });

  test('a provider webhook that arrives first confirms the order, and repeated notifications change nothing', async () => {
    const tx = await placeOrderAndGetTxRef(page);
    const o = tx.slice(0, 12);
    eq((await ctl<{ webhookStatus: number | null }>('/pay', { txRef: tx, mode: 'success', webhook: true })).webhookStatus, 200, 'webhook accepted');
    await returnToShop(page, o, tx);
    await page.waitForSelector('text=Payment confirmed', { timeout: 20_000 });
    const before = await stockOf('party-pack');
    eq((await ctl<{ webhookStatus: number | null }>('/pay', { txRef: tx, mode: 'success', webhook: true })).webhookStatus, 200, 'repeat webhook accepted');
    const rows = (await ctl<Array<{ orderNumber: string }>>('/orders')).filter((x) => x.orderNumber === o);
    eq(rows.length, 1, 'one order');
    eq((await orderFact(o)).paymentStatus, 'paid', 'still paid');
    eq(await stockOf('party-pack'), before, 'stock unchanged');
  });

  test('a failed payment is explained, and the retry opens a NEW checkout that then succeeds', async () => {
    await addToCart(page, 'party-pack', 1);
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-total"]');
    const tx1 = await placeOrderAndGetTxRef(page);
    const o1 = tx1.slice(0, 12);
    await ctl('/pay', { txRef: tx1, mode: 'fail' });
    await returnToShop(page, o1, tx1);
    await page.waitForSelector('text=Your payment did not go through', { timeout: 20_000 });
    const retry = page.waitForRequest((r) => r.url().startsWith('https://checkout.flutterwave.com/'), { timeout: 20_000 });
    await page.click('button:has-text("Try payment again")');
    const tx2 = (await retry).url().split('/').pop() as string;
    await page.waitForSelector('#fw'); // let the (stubbed) hosted page finish loading before navigating away
    expect(tx2).not.toBe(tx1);
    await ctl('/pay', { txRef: tx2, mode: 'success' });
    await returnToShop(page, o1, tx2);
    await page.waitForSelector('text=Payment confirmed', { timeout: 20_000 });
  });

  test('an amount mismatch is not credited: the customer is told it is under review', async () => {
    await addToCart(page, 'party-pack', 1);
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-total"]');
    const tx = await placeOrderAndGetTxRef(page);
    const o = tx.slice(0, 12);
    await ctl('/pay', { txRef: tx, mode: 'wrong_amount' });
    await returnToShop(page, o, tx);
    await page.waitForSelector('text=We received your payment', { timeout: 20_000 });
    const row = await orderFact(o);
    ok(row.status === 'pending' && row.paymentStatus === 'review', `order not confirmed: ${JSON.stringify(row)}`);
  });

  test('cancelling returns the stock once, and a later expiry sweep returns nothing more', async () => {
    const before = await stockOf('last-one');
    await addToCart(page, 'last-one', 1);
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-total"]');
    const o = (await placeOrderAndGetTxRef(page)).slice(0, 12);
    eq(await stockOf('last-one'), before - 1, 'held');
    await page.goto(`/my-orders/${o}`);
    await page.click('button:has-text("Cancel order")');
    await page.click('button:has-text("Yes, cancel it")');
    await page.waitForSelector('text=Cancelled');
    eq(await stockOf('last-one'), before, 'returned');
    await ctl('/expire-all', {});
    eq(await stockOf('last-one'), before, 'not returned twice');
  });

  test('an unpaid order past its window expires, its stock returns, and it can no longer be paid', async () => {
    const before = await stockOf('last-one');
    await addToCart(page, 'last-one', 1);
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-total"]');
    const o = (await placeOrderAndGetTxRef(page)).slice(0, 12);
    eq(await stockOf('last-one'), before - 1, 'held');
    ok((await ctl<{ expired: number }>('/expire-all', {})).expired >= 1, 'swept');
    eq(await stockOf('last-one'), before, 'returned after expiry');
    await page.goto(`/my-orders/${o}`);
    await page.waitForSelector('text=Expired');
    await expect(page.locator('button:has-text("Pay now")')).toHaveCount(0);
  });

  test('sold-out combos cannot be added, and the per-line limit stops the + button', async () => {
    await page.goto('/combos/gone-combo');
    await expect(page.locator('button:has-text("Sold out")')).toBeDisabled();
    await page.evaluate(() => localStorage.removeItem('ene_cart_v1'));
    await addToCart(page, 'jollof-feast', 5);
    await page.goto('/cart');
    await page.waitForSelector('[data-testid="cart-total"]');
    await expect(page.locator('button[aria-label^="Increase quantity"]')).toBeDisabled();
  });

  test('another customer cannot see or act on my order (404), and signed-out visitors are asked to sign in', async ({ browser }) => {
    const other = await customerContext(browser);
    const B = await other.newPage();
    await register(B, `other.${Date.now()}@journey.test`);
    await B.waitForURL('**/my-orders');
    await B.goto(`/my-orders/${order}`);
    await B.waitForSelector('text=We could not find that order');
    const status = await B.evaluate(async (o) => (await fetch(`/api/store/storefront/orders/${o}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, order);
    eq(status, 404, "cancelling someone else's order");
    await other.close();

    const anon = await customerContext(browser);
    const C = await anon.newPage();
    await C.goto('/my-orders');
    await C.waitForSelector('text=Sign in to continue');
    await C.goto(`/checkout/payment-return?order=${order}`);
    await C.waitForSelector('text=Sign in to continue');
    await anon.close();
  });

  test('customer and staff stay separate: a customer is redirected away from the staff area', async () => {
    await page.goto('/inventory');
    await page.waitForURL('**/login');
  });

  test('the mobile layout of the cart is usable at 375px with no horizontal scroll', async ({ browser }) => {
    const mobile = await customerContext(browser, { viewport: { width: 375, height: 800 } });
    const M = await mobile.newPage();
    await addToCart(M, 'party-pack', 2);
    await M.goto('/cart');
    await M.waitForSelector('[data-testid="cart-total"]');
    ok(!(await M.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal overflow on /cart');
    await mobile.close();
  });

  test('EMAIL: the journey queued the right emails, one per event, to the customer only, with no secrets', async () => {
    const counts = await ctl<{ sent: number }>('/notify');
    ok(counts.sent > 0, 'the worker sent mail');
    const mails = await ctl<MailFact[]>('/mails');
    const subjects = mails.map((m) => m.subject.replace(/ENE-[A-Z0-9]{8}/, '<order>'));
    ok(subjects.some((s) => /Payment received for order/.test(s)), 'payment received');
    ok(subjects.some((s) => /has been cancelled/.test(s)), 'cancelled');
    ok(subjects.some((s) => /checking your payment/.test(s)), 'under review (the mismatch)');
    const keys = mails.map((m) => m.key);
    eq(new Set(keys).size, keys.length, 'no duplicate idempotency keys');
    ok(mails.every((m) => /@journey\.test$/.test(m.to)), 'only journey customers are addressed');
    ok(!/Bearer |eyJ[A-Za-z0-9_-]{20,}|FLWSECK|verif-hash/.test(mails.map((m) => m.html).join('')), 'no tokens or secrets in any email');
    eq((await ctl<{ sent: number }>('/notify')).sent, 0, 'a second run sends nothing more');
  });

});
