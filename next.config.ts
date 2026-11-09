import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Build-time values the browser needs for error monitoring (Vercel provides the commit and environment).
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "",
  },
};

// Source-map upload runs only when the Sentry build credentials are present in the build environment. Without them the
// build is exactly what it was before monitoring existed, and nothing is uploaded or wrapped.
const canUploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default canUploadSourceMaps
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      telemetry: false,
      // Upload only the app's own code, and delete the maps from the build output after upload, so they are never served.
      widenClientFileUpload: false,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      release: { name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA },
    })
  : nextConfig;
