import * as Sentry from '@sentry/nextjs';
import { buildMonitoringOptions } from '@/lib/monitoring/config';
import { installSentryCapture } from '@/lib/monitoring/sentry-capture';

// Browser runtime. A no-op unless NEXT_PUBLIC_SENTRY_DSN is set (a DSN is a public, write-only identifier by design).
// No session replay, no user, no cookies: see lib/monitoring/config.ts.
const options = buildMonitoringOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  nodeEnv: process.env.NODE_ENV,
});
if (options) {
  Sentry.init(options);
  installSentryCapture();
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
