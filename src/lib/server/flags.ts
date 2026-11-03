/**
 * Storefront feature flag (server side only).
 *
 * Deliberately NOT a NEXT_PUBLIC_ variable: those are inlined into the browser
 * bundle at build time, which would make the switch require a rebuild and
 * expose it. This is read from the server environment on each request, so the
 * storefront can be turned on in Vercel without a deployment of new code, and
 * with it off (the default) production behaves exactly as before.
 */
export function isStorefrontEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.STOREFRONT_ENABLED === 'true';
}
