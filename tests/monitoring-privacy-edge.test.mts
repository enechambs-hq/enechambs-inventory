import assert from 'node:assert/strict';
import { test } from 'node:test';

/** The REAL edge-runtime SDK (the one the route-protection proxy uses) with a recording transport. */
const Sentry = await import('@sentry/vercel-edge');
const { buildMonitoringOptions, RESTRICTIVE_DATA_COLLECTION } = await import('../src/lib/monitoring/config.ts');

test('edge: the effective SDK configuration disables every data-collection category, and nothing private is sent', async () => {
  const base = buildMonitoringOptions({ dsn: 'https://abc123@o123.ingest.sentry.io/456', nodeEnv: 'production' }) as Record<string, unknown>;
  const { beforeSend: _b, ...sdkOnly } = base;
  void _b;
  const sent: string[] = [];
  Sentry.init({ ...sdkOnly, transport: () => ({ send: (e: unknown) => { sent.push(JSON.stringify(e)); return Promise.resolve({}); }, flush: () => Promise.resolve(true) }) } as never);
  Sentry.withScope((scope) => {
    scope.setTag('requestId', '3f2b8c1e-9d4a-4e7b-8a6f-1c2d3e4f5a6b');
    Sentry.captureException(new Error('edge boom'));
  });
  await Sentry.flush(2000);
  assert.deepEqual(Sentry.getClient()?.getOptions().dataCollection, RESTRICTIVE_DATA_COLLECTION);
  const out = sent.join('\n');
  assert.ok(out.includes('edge boom'));
  for (const secret of ['"cookies"', '"headers"', 'ip_address', 'context_line', '"vars"', '"user":{']) assert.ok(!out.includes(secret), secret);
});
