/**
 * What the app chooses to report as an incident, and what it never does. Pure: the real Sentry call is injected once by
 * the SDK setup files (`setCapture`), so this module (imported by the axios client and the proxy) never loads the SDK and
 * is a no-op when monitoring is off or not yet initialised.
 *
 * Reported:   an API/proxy answer with status >= 500 (a server fault), and an exception caught by an error boundary.
 * NOT reported: 400/422 validation, 401/403 (sign-in and permissions), 404, 409 business conflicts, 429, and requests
 *               that never got an answer (the person's connection). Those are normal operation, not incidents.
 */
import { scrubText } from './config.ts';

export interface CapturedEvent {
  name: string;
  message: string;
  level: 'error' | 'warning';
  tags: Record<string, string>;
  fingerprint: string[];
}
export type CaptureFn = (event: CapturedEvent) => void;

let capture: CaptureFn | null = null;
export function setCapture(fn: CaptureFn | null): void {
  capture = fn;
}

/** Only server faults are incidents. */
export const shouldReportStatus = (status: number | undefined): boolean => typeof status === 'number' && status >= 500 && status <= 599;

const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ENE-[A-Z0-9]{8}|\d+|[0-9a-f]{16,})$/i;

/** "/api/v1/admin/storefront-orders/ENE-ABCD2345?x=1" -> "/api/v1/admin/storefront-orders/:id" (no query, no ids). */
export function routeOf(url: string | undefined): string {
  if (typeof url !== 'string') return '[unknown]';
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0].split('#')[0];
  if (!path.startsWith('/')) return '[unknown]';
  return path.split('/').map((seg) => (ID_SEGMENT.test(seg) ? ':id' : seg.length > 40 ? ':id' : seg)).join('/').slice(0, 200);
}

const SAFE_TAG = /^[A-Za-z0-9._:/-]{1,100}$/;
const tag = (v: unknown): string | undefined => (typeof v === 'string' && SAFE_TAG.test(v) ? v : undefined);

// ── de-duplication: one incident per request, and at most one per minute for an identical repeating failure ──────────
const seenRequestIds: string[] = [];
const lastByKey = new Map<string, number>();
const REPEAT_WINDOW_MS = 60_000;
const MAX_REMEMBERED = 200;

function isDuplicate(requestId: string | undefined, key: string, now: number): boolean {
  if (requestId) {
    if (seenRequestIds.includes(requestId)) return true;
    seenRequestIds.push(requestId);
    if (seenRequestIds.length > MAX_REMEMBERED) seenRequestIds.shift();
  }
  const last = lastByKey.get(key);
  if (last !== undefined && now - last < REPEAT_WINDOW_MS) return true;
  lastByKey.set(key, now);
  if (lastByKey.size > MAX_REMEMBERED) lastByKey.delete(lastByKey.keys().next().value as string);
  return false;
}

/** Test helper: forget what has been reported. */
export function resetReported(): void {
  seenRequestIds.length = 0;
  lastByKey.clear();
}

export interface ApiFailure {
  status?: number;
  method?: string;
  url?: string;
  /** The API's machine code, e.g. INTERNAL_ERROR, UPSTREAM_UNAVAILABLE. */
  code?: string;
  /** The correlation id (X-Request-ID), to find the same request in the server logs. */
  requestId?: string;
  source: 'staff' | 'storefront' | 'proxy' | 'bff';
}

/** Reports a failed API exchange if (and only if) it was a server fault. Returns whether it was sent. */
export function reportApiFailure(f: ApiFailure, now: number = Date.now()): boolean {
  if (!capture || !shouldReportStatus(f.status)) return false;
  const route = routeOf(f.url);
  const method = (f.method ?? 'GET').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) || 'GET';
  if (isDuplicate(f.requestId, `${f.source}|${method}|${route}|${f.status}`, now)) return false;
  const tags: Record<string, string> = { source: f.source, 'http.method': method, 'http.route': route, 'http.status_code': String(f.status) };
  const code = tag(f.code);
  if (code) tags['error.code'] = code;
  const requestId = tag(f.requestId);
  if (requestId) tags.requestId = requestId;
  capture({
    name: 'ApiServerError',
    message: `API ${f.status} ${method} ${route}`,
    level: 'error',
    tags,
    fingerprint: ['api-server-error', f.source, method, route, String(f.status)],
  });
  return true;
}

/** An exception caught by an error boundary: always unexpected. The message is scrubbed; only Next's opaque digest is tagged. */
export function reportBoundaryError(error: unknown, boundary: string, now: number = Date.now()): boolean {
  if (!capture) return false;
  const e = (error ?? {}) as { name?: unknown; message?: unknown; digest?: unknown };
  const name = typeof e.name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(e.name) ? e.name : 'Error';
  const message = typeof e.message === 'string' ? scrubText(e.message) : 'unknown error';
  if (isDuplicate(undefined, `boundary|${boundary}|${name}|${message}`, now)) return false;
  const tags: Record<string, string> = { boundary: tag(boundary) ?? 'unknown' };
  const digest = tag(e.digest);
  if (digest) tags.digest = digest;
  capture({ name, message, level: 'error', tags, fingerprint: ['boundary', boundary, name, message.slice(0, 80)] });
  return true;
}
