import * as Sentry from '@sentry/nextjs';
import { setCapture, type CapturedEvent } from './report.ts';

/** Installs the real Sentry capture behind `report.ts`. Called by the SDK setup files only, after Sentry.init. */
export function installSentryCapture(): void {
  setCapture((event: CapturedEvent) => {
    const error = new Error(event.message);
    error.name = event.name;
    Sentry.withScope((scope) => {
      scope.setLevel(event.level);
      for (const [key, value] of Object.entries(event.tags)) scope.setTag(key, value);
      scope.setFingerprint(event.fingerprint);
      Sentry.captureException(error);
    });
  });
}
