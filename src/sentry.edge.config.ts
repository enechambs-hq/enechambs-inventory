import * as Sentry from '@sentry/nextjs';
import { buildMonitoringOptions } from '@/lib/monitoring/config';

// Edge runtime (the route-protection proxy). A no-op unless SENTRY_DSN is set.
const options = buildMonitoringOptions({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  nodeEnv: process.env.NODE_ENV,
});
if (options) Sentry.init(options);
