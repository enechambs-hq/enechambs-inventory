import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * The REAL browser SDK (the one @sentry/nextjs uses in the browser) with a stubbed page: a URL with a query string and
 * fragment, a referrer with a query, a cookie and a user agent, and its network transport replaced by a recorder.
 * Our scrubbers (`beforeSend`) are switched off so the test proves the SDK's own configuration. A control run with
 * Sentry v11's defaults shows the same harness sees that data when collection is left unset.
 */
const loc = { href: 'https://app.example.com/storefront-orders?email=ada.obi@example.com&token=QUERY_SECRET_TOKEN_321#frag', pathname: '/storefront-orders', search: '?email=ada.obi@example.com&token=QUERY_SECRET_TOKEN_321', origin: 'https://app.example.com', host: 'app.example.com', hostname: 'app.example.com', protocol: 'https:' };
const g = globalThis as Record<string, unknown>;
g.window = g;
g.location = loc;
g.document = { referrer: 'https://shop.example.com/cart?secret=REFERRER_SECRET_999', cookie: 'ene_cust=COOKIE_SECRET_VALUE_123', addEventListener() {}, removeEventListener() {}, location: loc, documentElement: {}, visibilityState: 'visible' };
Object.defineProperty(g, 'navigator', { value: { userAgent: 'UA_SECRET_AGENT/1.0', language: 'en-NG', languages: ['en-NG'] }, configurable: true });
g.addEventListener = () => {};
g.removeEventListener = () => {};

const Sentry = await import('@sentry/browser');
const { buildMonitoringOptions, RESTRICTIVE_DATA_COLLECTION } = await import('../src/lib/monitoring/config.ts');

const SECRETS = ['ada.obi', 'QUERY_SECRET_TOKEN_321', 'REFERRER_SECRET_999', 'COOKIE_SECRET_VALUE_123', 'UA_SECRET_AGENT', 'context_line', '"headers"', 'ip_address', '"vars"'];

async function run(mode: 'restrictive' | 'defaults') {
  const base = buildMonitoringOptions({ dsn: 'https://abc123@o123.ingest.sentry.io/456', nodeEnv: 'production' }) as Record<string, unknown>;
  const { beforeSend: _b, dataCollection, sendDefaultPii, ...rest } = base;
  void _b;
  const options = mode === 'restrictive' ? { ...rest, dataCollection, sendDefaultPii } : rest;
  const sent: string[] = [];
  Sentry.init({ ...options, transport: () => ({ send: (e: unknown) => { sent.push(JSON.stringify(e)); return Promise.resolve({}); }, flush: () => Promise.resolve(true) }) } as never);
  Sentry.captureException(new Error('browser boom'));
  await Sentry.flush(2000);
  const resolved = Sentry.getClient()?.getOptions().dataCollection;
  await Sentry.close();
  return { out: sent.join('\n'), resolved };
}

test('browser: every data-collection category is explicitly disabled in the effective SDK configuration', async () => {
  const { resolved, out } = await run('restrictive');
  assert.ok(out.includes('browser boom'), 'an event was sent');
  assert.deepEqual(resolved, RESTRICTIVE_DATA_COLLECTION);
});

test('browser: with the SDK configuration alone, no URL query, referrer, cookie, user agent, headers, user or source context is sent', async () => {
  const { out } = await run('restrictive');
  for (const secret of SECRETS) assert.ok(!out.includes(secret), `leaked: ${secret}`);
});

test('control: with Sentry v11 defaults the same page DOES leak (so the checks above are meaningful)', async () => {
  const { out } = await run('defaults');
  const leaked = SECRETS.filter((s) => out.includes(s));
  assert.ok(leaked.length >= 2, `expected the defaults to leak, saw: ${leaked.join(', ')}`);
});
