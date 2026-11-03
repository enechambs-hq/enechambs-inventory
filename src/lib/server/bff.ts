/**
 * Pure helpers for the customer backend-for-frontend (BFF).
 *
 * Kept free of Next.js imports so they run under `node --test` and can be
 * checked against the backend byte for byte (see tests/bff.test.mts and the
 * backend's src/common/client-ip/client-ip-signature.spec.ts, which assert the
 * same golden vectors).
 *
 * Only erasable TypeScript syntax is used here (no enums, no parameter
 * properties) so Node can execute this file directly in tests.
 */
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

/** Name of the HttpOnly cookie holding the customer's session token (set in M3). */
export const CUSTOMER_COOKIE = 'ene_cust';

export const CLIENT_IP_HEADER = 'x-bff-client-ip';
export const CLIENT_IP_TIMESTAMP_HEADER = 'x-bff-timestamp';
export const CLIENT_IP_SIGNATURE_HEADER = 'x-bff-signature';

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_QUERY_LENGTH = 2048;

// ── signed client IP ────────────────────────────────────────────────────────

export function canonicalString(input: {
  ip: string;
  method: string;
  path: string;
  timestampMs: number;
}): string {
  return [
    'v1',
    String(input.timestampMs),
    input.ip,
    input.method.toUpperCase(),
    input.path,
  ].join('\n');
}

export function signClientIp(input: {
  ip: string;
  method: string;
  path: string;
  timestampMs: number;
  secret: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(canonicalString(input))
    .digest('hex');
}

/**
 * Header set the API verifies. `path` is the BACKEND request path without the
 * query string, e.g. /api/v1/storefront/combos.
 */
export function signedClientIpHeaders(input: {
  ip: string;
  method: string;
  path: string;
  secret: string;
  nowMs?: number;
}): Record<string, string> {
  const timestampMs = input.nowMs ?? Date.now();
  return {
    [CLIENT_IP_HEADER]: input.ip,
    [CLIENT_IP_TIMESTAMP_HEADER]: String(timestampMs),
    [CLIENT_IP_SIGNATURE_HEADER]: signClientIp({
      ip: input.ip,
      method: input.method,
      path: input.path,
      timestampMs,
      secret: input.secret,
    }),
  };
}

// ── client IP source ────────────────────────────────────────────────────────

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * The visitor's address, or null when it cannot be trusted.
 *
 * Vercel sets x-forwarded-for / x-vercel-forwarded-for itself and does not
 * forward a client-supplied value (Vercel documentation, "Request headers").
 * That guarantee exists ONLY on Vercel, so these headers are honoured only
 * when the platform marks the runtime (VERCEL=1). Anywhere else (local
 * development, a self-hosted proxy) a browser could set them, so they are
 * ignored and the API falls back to its socket-address bucket. The value only
 * ever selects a rate-limit bucket; it is never used for authorisation.
 */
export function resolveClientIp(
  headers: HeaderReader,
  env: Record<string, string | undefined>,
): string | null {
  if (env.VERCEL !== '1') return null;
  const raw =
    headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for');
  if (!raw) return null;
  const first = raw.split(',')[0].trim();
  return isIP(first) === 0 ? null : first;
}

// ── request validation ──────────────────────────────────────────────────────

const SEGMENT = /^[A-Za-z0-9._~-]{1,100}$/;

/**
 * Turns catch-all route segments into a backend path, or null if anything
 * about it is not acceptable. Only `storefront/...` is reachable through the
 * customer BFF: staff routes and the payment webhook are not, whatever the
 * browser asks for. Segments use a strict allowlist, so no encoded traversal,
 * slashes or control characters can get through.
 */
export function backendPathFromSegments(segments: string[]): string | null {
  if (segments.length < 2 || segments.length > 6) return null;
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return null;
    if (!SEGMENT.test(segment)) return null;
  }
  if (segments[0] !== 'storefront') return null;
  return segments.join('/');
}

/**
 * The origin the browser addressed this request to, rebuilt from the request's
 * own Host header (and the protocol the platform reports). Browsers set Origin
 * and Host themselves and page script cannot forge either, so a cross-site
 * page's Origin will never equal this. Deliberately not derived from Next's
 * parsed URL, which is not guaranteed to match what the browser used behind a
 * proxy.
 */
export function requestOrigin(
  headers: HeaderReader,
  fallbackProtocol: string,
): string | null {
  const host = headers.get('host');
  if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:]+\](:\d{1,5})?$/.test(host)) {
    return null;
  }
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwarded === 'http' || forwarded === 'https' ? forwarded : fallbackProtocol;
  if (protocol !== 'http' && protocol !== 'https') return null;
  return `${protocol}://${host}`;
}

/**
 * CSRF defence for state-changing requests: the browser must say the request
 * came from an allowed origin. Missing or different origins are refused.
 */
export function isAllowedOrigin(
  origin: string | null,
  allowed: Array<string | undefined>,
): boolean {
  if (!origin) return false;
  return allowed.some((a) => {
    if (!a) return false;
    try {
      return new URL(a).origin === origin;
    } catch {
      return false;
    }
  });
}

/** Idempotency keys are opaque client-generated ids (a UUID is typical). */
export function sanitizeIdempotencyKey(value: string | null): string | null {
  if (value === null) return null;
  return /^[A-Za-z0-9_-]{16,128}$/.test(value) ? value : null;
}

/** A JWT is three base64url segments; refuse anything else before forwarding. */
export function sanitizeBearerToken(value: string | undefined): string | null {
  if (!value || value.length > 4096) return null;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    ? value
    : null;
}
