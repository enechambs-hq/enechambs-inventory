import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ctl, type StaffTokens } from './control';

export const password = 'Sup3rSecret!pw';

/** Assertion helpers with the (actual, expected, message) shape. */
export const eq = (actual: unknown, expected: unknown, message: string): void => expect(actual, message).toEqual(expected);
export const ok = (condition: unknown, message: string): void => expect(Boolean(condition), message).toBe(true);

let phoneSalt = 0;
/** A unique valid Nigerian phone number per call (customers' phones are unique). */
export const uniquePhone = (): string => `0803${String(Date.now()).slice(-6)}${String((phoneSalt += 1) % 10)}`;

/**
 * A browser context in which the hosted Flutterwave page (an external site) is
 * replaced by a stub, so the journey can be driven without any external network.
 */
export async function customerContext(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  await context.route('https://checkout.flutterwave.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="fw">Flutterwave (stub)</h1>' }),
  );
  return context;
}

/** A staff or admin session: the staff `token` cookie plus the localStorage the staff app reads. */
export async function staffContext(browser: Browser, who: 'admin' | 'staff', tokens: StaffTokens): Promise<BrowserContext> {
  const context = await browser.newContext();
  const t = tokens[who];
  await context.addCookies([{ name: 'token', value: t.token, domain: 'localhost', path: '/' }]);
  await context.addInitScript(([token, user]) => {
    localStorage.setItem('token', token as string);
    localStorage.setItem('user', JSON.stringify(user));
  }, [t.token, t.user] as const);
  return context;
}

/** Registers through the real flow: details first, then the emailed code (read from the fake mailer). */
export async function register(page: Page, email: string, next?: string, phone: string = uniquePhone()): Promise<void> {
  await page.goto(`/account/register${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  await page.fill('#name', 'Ada Obi');
  await page.fill('#email', email);
  await page.fill('#phone', phone);
  await page.fill('#password', password);
  await page.click('button:has-text("Create account")');
  await page.waitForSelector('#code');
  const { code } = await ctl<{ code: string | null }>(`/code?email=${encodeURIComponent(email)}`);
  ok(code && /^\d{6}$/.test(code), 'a six-digit code was emailed');
  await page.fill('#code', code as string);
  await page.click('button:has-text("Verify and sign in")');
}

export async function addToCart(page: Page, slug: string, times = 1): Promise<void> {
  await page.goto(`/combos/${slug}`);
  await page.waitForSelector('button:has-text("Add")');
  for (let i = 0; i < times; i += 1) await page.click('button:has-text("Add")');
}

/** Clicks "Place order and pay" and returns our payment reference from the hosted-page address. */
export async function placeOrderAndGetTxRef(page: Page): Promise<string> {
  const navigation = page.waitForRequest((r) => r.url().startsWith('https://checkout.flutterwave.com/'), { timeout: 20_000 });
  await page.click('button:has-text("Place order and pay")');
  const request = await navigation;
  await page.waitForSelector('#fw'); // let the (stubbed) hosted page finish loading
  return request.url().split('/').pop() as string;
}

/** Where Flutterwave sends the customer back; the query it appends is deliberately ignored by the app. */
export const returnToShop = (page: Page, order: string, txRef: string): Promise<unknown> =>
  page.goto(`/checkout/payment-return?order=${order}&status=successful&tx_ref=${txRef}&transaction_id=999`);

export const lagosToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
