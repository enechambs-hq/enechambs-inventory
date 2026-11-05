/**
 * Where to send a visitor after sign-in. The `next` value comes from the URL,
 * so it is untrusted: only a same-site path to one of the customer pages is
 * honoured (no scheme, no host, no protocol-relative `//`, no backslashes, no
 * control characters). Anything else falls back to the default.
 */
const ALLOWED_PREFIXES = ['/checkout', '/my-orders', '/cart', '/combos'] as const;

export function safeNextPath(raw: string | string[] | null | undefined, fallback = '/my-orders'): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  let path: string;
  try {
    // Resolve against a dummy origin; a different origin means it was not a plain path.
    const url = new URL(value, 'https://storefront.invalid');
    if (url.origin !== 'https://storefront.invalid') return fallback;
    path = url.pathname;
  } catch {
    return fallback;
  }
  const ok = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  return ok ? value : fallback;
}

export const loginHref = (next?: string): string =>
  next ? `/account/login?next=${encodeURIComponent(safeNextPath(next, '/my-orders'))}` : '/account/login';

export const registerHref = (next?: string): string =>
  next ? `/account/register?next=${encodeURIComponent(safeNextPath(next, '/my-orders'))}` : '/account/register';

/**
 * The hosted checkout address the API returned. Only an https URL on a
 * Flutterwave domain is ever navigated to, so a tampered response cannot send
 * the customer to an arbitrary site.
 */
export function isTrustedCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    // dev-flutterwave.com is the host of Flutterwave's Test Mode hosted checkout.
    const onFlutterwave = (domain: string) => url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    return url.protocol === 'https:' && (onFlutterwave('flutterwave.com') || onFlutterwave('dev-flutterwave.com'));
  } catch {
    return false;
  }
}
