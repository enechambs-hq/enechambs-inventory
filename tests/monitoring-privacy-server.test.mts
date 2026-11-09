import assert from 'node:assert/strict';
import * as http from 'node:http';
import { test } from 'node:test';

/**
 * The REAL Node SDK (the server half of @sentry/nextjs) with automatic HTTP instrumentation, tracing at 100% and a real
 * request carrying a cookie, authorization and custom headers, a query string and a body. Our scrubbers are switched
 * off, so only the SDK configuration is under test; the transport is a recorder.
 */
const Sentry = await import('@sentry/nextjs');
const { buildMonitoringOptions, RESTRICTIVE_DATA_COLLECTION } = await import('../src/lib/monitoring/config.ts');

const S = { cookie: 'COOKIE_SECRET_VALUE_123', bearer: 'BEARER_SECRET_TOKEN_456', header: 'HEADER_SECRET_789', email: 'ada.obi@example.com', token: 'QUERY_SECRET_TOKEN_321', body: 'BODY_PASSWORD_Sup3rSecret', local: 'LOCAL_VARIABLE_SECRET_555' };

async function run(restrictive: boolean, production = false) {
  const base = buildMonitoringOptions({ dsn: 'https://abc123@o123.ingest.sentry.io/456', nodeEnv: 'production' }) as Record<string, unknown>;
  const { beforeSend: _b, beforeSendSpan: _s, beforeBreadcrumb: _c, dataCollection, sendDefaultPii, ...rest } = base;
  void _b; void _s; void _c;
  const initial = production ? base : { ...rest, ...(restrictive ? { dataCollection, sendDefaultPii } : {}) };
  const sent: string[] = [];
  Sentry.init({
    ...initial, tracesSampleRate: 1,
    transport: () => ({ send: (e: unknown) => { sent.push(JSON.stringify(e)); return Promise.resolve({}); }, flush: () => Promise.resolve(true) }),
  } as never);
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      try {
        (function failWithLocal() { const secretLocal = S.local; throw new Error(`boom ${secretLocal.length}`); })();
      } catch (e) {
        // What Next's `onRequestError` hook does for an unhandled server error (it hands over the request's headers and path).
        Sentry.captureRequestError(e, { path: `/api/v1/x?email=${S.email}&token=${S.token}`, method: 'POST', headers: { cookie: `ene_cust=${S.cookie}`, authorization: `Bearer ${S.bearer}`, 'x-custom-secret': S.header } }, { routerKind: 'App Router', routePath: '/api/v1/[...path]', routeType: 'route' });
      }
      res.statusCode = 500; res.end('{}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: `/api/v1/x?email=${S.email}&token=${S.token}`, headers: { 'content-type': 'application/json', cookie: `ene_cust=${S.cookie}`, authorization: `Bearer ${S.bearer}`, 'x-custom-secret': S.header, 'user-agent': 'privacy-test' } }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.end(JSON.stringify({ password: S.body }));
  });
  await new Promise((r) => setTimeout(r, 300));
  await Sentry.flush(3000);
  server.close();
  const resolved = Sentry.getClient()?.getOptions().dataCollection;
  await Sentry.close();
  return { out: sent.join('\n'), resolved };
}

test('server: the effective SDK configuration disables every data-collection category', async () => {
  const { resolved, out } = await run(true);
  assert.ok(out.includes('boom'), 'an event was sent');
  assert.deepEqual(resolved, RESTRICTIVE_DATA_COLLECTION);
});

test('server: automatically collected cookies, headers, query, body, user, IP, local variables and source context are not sent', async () => {
  const { out } = await run(true);
  for (const secret of [...Object.values(S), 'ip_address', 'context_line', '"vars"', '"cookies"', 'x-custom-secret']) assert.ok(!out.includes(secret), `leaked: ${secret}`);
  assert.ok(out.includes('"server_name":"enechambs-frontend"'), 'the machine host name is replaced by a fixed name');
});

test('control: with Sentry v11 defaults the same request DOES leak', async () => {
  const { out } = await run(false);
  const leaked = [S.email, S.header, 'context_line', 'privacy-test'].filter((s) => out.includes(s));
  assert.ok(leaked.length >= 2, `expected leakage, saw: ${leaked.join(', ')}`);
});

test('server: the onRequestError path (Next hands the SDK the request headers and path) sends none of them, with the SDK configuration alone and in production', async () => {
  for (const production of [false, true]) {
    const { out } = await run(true, production);
    assert.ok(out.includes('boom'), 'an event was sent');
    for (const secret of [S.cookie, S.bearer, S.header, S.email, S.token, 'x-custom-secret', '"cookies"']) assert.ok(!out.includes(secret), `leaked (${production ? 'production' : 'sdk only'}): ${secret}`);
  }
});
