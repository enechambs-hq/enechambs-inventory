import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  MAX_BODY_BYTES,
  MAX_QUERY_LENGTH,
  backendPathFromSegments,
  isAllowedOrigin,
  requestOrigin,
  resolveClientIp,
  sanitizeBearerToken,
  sanitizeIdempotencyKey,
  signedClientIpHeaders,
} from '@/lib/server/bff';
import { isStorefrontEnabled } from '@/lib/server/flags';

/**
 * Customer backend-for-frontend (M0 foundation; storefront pages come later).
 *
 *   browser ──► /api/store/<storefront/...> ──► <BACKEND_URL>/api/v1/<storefront/...>
 *
 * It is the ONLY way customer traffic reaches the API:
 *   - 404s unless STOREFRONT_ENABLED=true, so production is unchanged until launch.
 *   - Forwards only paths under `storefront/` (never staff routes or webhooks).
 *   - The customer's session token lives in an HttpOnly cookie. This handler
 *     reads it and attaches it itself; an Authorization header sent by the
 *     browser is never forwarded.
 *   - Browser headers are not forwarded wholesale. Only content-type, a
 *     validated Idempotency-Key, and the headers set here go upstream, so a
 *     browser cannot inject x-bff-* values.
 *   - Signs the visitor's address so the API can rate-limit per visitor
 *     instead of per proxy (see docs/STOREFRONT_ROUTING.md).
 *   - State-changing requests must carry an allowed Origin (CSRF).
 *   - Never forwards Set-Cookie. Session cookies are set by dedicated handlers
 *     (M3), which take precedence over this catch-all.
 *
 * Route Handlers are public HTTP endpoints, so every check lives here rather
 * than in proxy.ts (Next.js docs: a Proxy matcher cannot be relied on to cover
 * Route Handlers or Server Functions).
 *
 * The existing admin proxy at /api/v1/[...path] is untouched.
 */

type Params = Promise<{ path: string[] }>;

const json = (body: unknown, status: number, extra: HeadersInit = {}) =>
  NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...extra },
  });

async function handle(req: NextRequest, { params }: { params: Params }) {
  if (!isStorefrontEnabled()) {
    return json({ message: 'Not found' }, 404);
  }

  const { path: segments } = await params;
  const path = backendPathFromSegments(segments);
  if (!path) return json({ message: 'Not found' }, 404);

  const secret = process.env.BFF_SHARED_SECRET;
  const backend = process.env.BACKEND_URL ?? 'https://enechambs-api.onrender.com';
  if (!secret) {
    console.error('Storefront BFF: BFF_SHARED_SECRET is not configured');
    return json({ message: 'Storefront is not available' }, 503);
  }

  const method = req.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  if (hasBody) {
    if (
      !isAllowedOrigin(req.headers.get('origin'), [
        requestOrigin(req.headers, req.nextUrl.protocol.replace(':', '')) ?? undefined,
        process.env.STOREFRONT_PUBLIC_URL,
      ])
    ) {
      return json({ message: 'Forbidden' }, 403);
    }
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return json({ message: 'Unsupported media type' }, 415);
    }
  }

  const rawQuery = req.nextUrl.search;
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return json({ message: 'Request too large' }, 414);
  }

  const idempotencyHeader = req.headers.get('idempotency-key');
  const idempotencyKey = sanitizeIdempotencyKey(idempotencyHeader);
  if (idempotencyHeader !== null && !idempotencyKey) {
    return json({ message: 'Invalid Idempotency-Key' }, 400);
  }

  let body: string | undefined;
  if (hasBody) {
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) return json({ message: 'Request too large' }, 413);
    body = await req.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return json({ message: 'Request too large' }, 413);
    }
  }

  const url = new URL(`/api/v1/${path}${rawQuery}`, backend);

  const headers = new Headers({ accept: 'application/json' });
  if (hasBody) headers.set('content-type', 'application/json');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);

  const token = sanitizeBearerToken(req.cookies.get(CUSTOMER_COOKIE)?.value);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const ip = resolveClientIp(req.headers, process.env);
  if (ip) {
    const signed = signedClientIpHeaders({ ip, method, path: url.pathname, secret });
    for (const [name, value] of Object.entries(signed)) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return json(
      { message: timedOut ? 'The service took too long to respond' : 'Service unavailable' },
      timedOut ? 504 : 502,
    );
  }

  const responseHeaders: Record<string, string> = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  };
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) responseHeaders['retry-after'] = retryAfter;

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
