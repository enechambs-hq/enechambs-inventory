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
import { createHash, createHmac, randomBytes } from 'node:crypto';
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

// ── request authentication (BFF -> API) ─────────────────────────────────────
//
// The API refuses every storefront/auth/* request that does not carry this
// signature, so a browser cannot call those routes directly and read the access
// token that login and verify-email return (CORS is not authentication). Only
// this server holds BFF_SHARED_SECRET.
//
// Protocol v2, identical to the API's src/common/bff-auth/bff-request-signature.ts
// (golden vectors are asserted in both repositories):
//
//   key       = HMAC-SHA256(BFF_SHARED_SECRET, "enechambs:bff-request-auth:v2")
//   canonical = "enechambs-bff-request-v2" LF timestampMs LF nonce LF METHOD
//               LF path LF hex(SHA-256(body))
//   signature = hex(HMAC-SHA256(key, canonical))
//
// It binds the method, the exact backend path (no query string), the timestamp,
// a per-request random NONCE and a digest of the EXACT BYTES forwarded. The
// nonce is what lets the API refuse a replay: it records every nonce it accepts
// in PostgreSQL and refuses a second use, so a captured request cannot be sent
// again within its validity window. Every request therefore gets a fresh 128-bit
// nonce; nothing is cached or reused, and a retry is a new request with a new
// nonce. v1 (no nonce) is no longer accepted by the API.
//
// Separate from the signed client-IP headers above, which only assert a visitor
// address for rate limiting and are unchanged. The key is derived, so the raw
// secret that signs client IPs is never this MAC's key.

export const BFF_AUTH_VERSION = 'v2';
export const BFF_AUTH_VERSION_HEADER = 'x-bff-auth-version';
export const BFF_AUTH_TIMESTAMP_HEADER = 'x-bff-auth-timestamp';
export const BFF_AUTH_NONCE_HEADER = 'x-bff-auth-nonce';
export const BFF_AUTH_SIGNATURE_HEADER = 'x-bff-auth-signature';

export const deriveBffAuthKey = (secret: string): Buffer =>
  createHmac('sha256', secret).update('enechambs:bff-request-auth:v2').digest();

export const bodyDigestHex = (body: Uint8Array | undefined): string =>
  createHash('sha256').update(body ?? new Uint8Array(0)).digest('hex');

/** 128 random bits as 22 base64url characters. One per request, never reused. */
export const generateBffNonce = (): string => randomBytes(16).toString('base64url');

export function signBffRequest(input: {
  secret: string;
  method: string;
  path: string;
  timestampMs: number;
  nonce: string;
  body?: Uint8Array;
}): string {
  const canonical = [
    'enechambs-bff-request-v2',
    String(input.timestampMs),
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    bodyDigestHex(input.body),
  ].join('\n');
  return createHmac('sha256', deriveBffAuthKey(input.secret))
    .update(canonical)
    .digest('hex');
}

/**
 * Headers proving a request came from this BFF. `body` MUST be the very bytes
 * passed to fetch (not a re-serialisation), `path` the backend path without the
 * query string. A fresh random nonce is generated unless a test supplies one.
 */
export function bffAuthHeaders(input: {
  secret: string;
  method: string;
  path: string;
  body?: Uint8Array;
  nowMs?: number;
  nonce?: string;
}): Record<string, string> {
  const timestampMs = input.nowMs ?? Date.now();
  const nonce = input.nonce ?? generateBffNonce();
  return {
    [BFF_AUTH_VERSION_HEADER]: BFF_AUTH_VERSION,
    [BFF_AUTH_TIMESTAMP_HEADER]: String(timestampMs),
    [BFF_AUTH_NONCE_HEADER]: nonce,
    [BFF_AUTH_SIGNATURE_HEADER]: signBffRequest({
      secret: input.secret,
      method: input.method,
      path: input.path,
      body: input.body,
      timestampMs,
      nonce,
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

/**
 * Reads one cookie from a Cookie header. No decoding: the only value read this
 * way is a JWT, which is validated afterwards by sanitizeBearerToken.
 */
export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export type BoundedRead =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'unreadable' };

/**
 * Reads a request body as a stream and enforces a limit on the bytes actually
 * received. Content-Length is not consulted: it may be absent (chunked
 * transfer) or wrong, so it cannot be the enforcement.
 *
 * - Counts bytes (chunk.byteLength), never string characters.
 * - Stops at the first chunk that takes the total over `maxBytes`: that chunk
 *   is discarded, the stream is cancelled so the sender is not drained, and
 *   the caller gets `too_large`. At most `maxBytes` are ever retained.
 * - Returns the raw bytes, so what is forwarded is exactly what was received.
 */
export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedRead> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Not awaited: the answer must not depend on the sender cooperating.
        void reader.cancel().catch(() => {});
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** A JWT is three base64url segments; refuse anything else before forwarding. */
export function sanitizeBearerToken(value: string | undefined): string | null {
  if (!value || value.length > 4096) return null;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
    ? value
    : null;
}
