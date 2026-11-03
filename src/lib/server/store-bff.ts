/**
 * Request handling for the customer BFF, kept apart from the Next.js route file
 * so it can be tested with plain Request objects and an injected fetch. The
 * route file at src/app/api/store/[...path]/route.ts is a thin wrapper.
 *
 * Only web-standard APIs are used here (Request, Response, URL, Headers).
 * See docs/STOREFRONT_ROUTING.md for the full contract.
 */
import {
  CUSTOMER_COOKIE,
  MAX_BODY_BYTES,
  MAX_QUERY_LENGTH,
  backendPathFromSegments,
  isAllowedOrigin,
  readBodyWithLimit,
  readCookie,
  requestOrigin,
  resolveClientIp,
  sanitizeBearerToken,
  sanitizeIdempotencyKey,
  signedClientIpHeaders,
} from './bff.ts';
import { isStorefrontEnabled } from './flags.ts';

export interface StoreBffDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  timeoutMs?: number;
}

const json = (body: unknown, status: number, extra: HeadersInit = {}) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...extra },
  });

export async function handleStoreRequest(
  req: Request,
  segments: string[],
  deps: StoreBffDeps,
): Promise<Response> {
  const { env } = deps;

  if (!isStorefrontEnabled(env)) {
    return json({ message: 'Not found' }, 404);
  }

  const path = backendPathFromSegments(segments);
  if (!path) return json({ message: 'Not found' }, 404);

  const secret = env.BFF_SHARED_SECRET;
  const backend = env.BACKEND_URL ?? 'https://enechambs-api.onrender.com';
  if (!secret) {
    console.error('Storefront BFF: BFF_SHARED_SECRET is not configured');
    return json({ message: 'Storefront is not available' }, 503);
  }

  const requestUrl = new URL(req.url);
  const method = req.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  if (hasBody) {
    if (
      !isAllowedOrigin(req.headers.get('origin'), [
        requestOrigin(req.headers, requestUrl.protocol.replace(':', '')) ??
          undefined,
        env.STOREFRONT_PUBLIC_URL,
      ])
    ) {
      return json({ message: 'Forbidden' }, 403);
    }
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return json({ message: 'Unsupported media type' }, 415);
    }
  }

  const rawQuery = requestUrl.search;
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return json({ message: 'Request too large' }, 414);
  }

  const idempotencyHeader = req.headers.get('idempotency-key');
  const idempotencyKey = sanitizeIdempotencyKey(idempotencyHeader);
  if (idempotencyHeader !== null && !idempotencyKey) {
    return json({ message: 'Invalid Idempotency-Key' }, 400);
  }

  let body: Uint8Array | undefined;
  if (hasBody) {
    // Cheap early refusal when the sender declares an oversized body. It is
    // only an optimisation: a missing or false Content-Length changes nothing,
    // because the stream below is what enforces the limit.
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      void req.body?.cancel().catch(() => {});
      return json({ message: 'Request too large' }, 413);
    }

    const read = await readBodyWithLimit(req.body, MAX_BODY_BYTES);
    if (!read.ok) {
      return read.reason === 'too_large'
        ? json({ message: 'Request too large' }, 413)
        : json({ message: 'Bad request' }, 400);
    }
    body = read.bytes;
  }

  const url = new URL(`/api/v1/${path}${rawQuery}`, backend);

  const headers = new Headers({ accept: 'application/json' });
  if (hasBody) headers.set('content-type', 'application/json');
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);

  const token = sanitizeBearerToken(
    readCookie(req.headers.get('cookie'), CUSTOMER_COOKIE),
  );
  if (token) headers.set('authorization', `Bearer ${token}`);

  const ip = resolveClientIp(req.headers, env);
  if (ip) {
    const signed = signedClientIpHeaders({
      ip,
      method,
      path: url.pathname,
      secret,
    });
    for (const [name, value] of Object.entries(signed)) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await deps.fetch(url, {
      method,
      headers,
      body: body as BodyInit | undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(deps.timeoutMs ?? 15_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return json(
      {
        message: timedOut
          ? 'The service took too long to respond'
          : 'Service unavailable',
      },
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

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}
