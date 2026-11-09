import { NextRequest, NextResponse } from 'next/server';
import { STAFF_PROXY_UPSTREAM_TIMEOUT_MS } from '../../../../lib/timeouts.ts';

const BACKEND =
  process.env.BACKEND_URL ?? 'https://enechambs-api.onrender.com';

/**
 * Seconds this function may run. A literal, because Next reads route config statically. It must exceed the upstream limit
 * (25s) so the 504 below can be sent; the browser's own limit (35s) is longer still. See lib/timeouts.ts.
 */
export const maxDuration = 30;

type Params = Promise<{ path: string[] }>;

const NO_BODY_STATUSES = new Set([204, 205, 304]);
const NO_BODY_HEADERS = ['content-type', 'etag', 'cache-control', 'last-modified'];

/**
 * The same JSON shape the API itself uses for errors ({ success, message, code }), so the browser handles a proxy
 * failure like any other API failure instead of choking on an HTML error page. Only the path (never the query string).
 */
function failure(req: NextRequest, status: 502 | 504, message: string, code: string) {
  return NextResponse.json(
    { success: false, message, code, timestamp: new Date().toISOString(), path: req.nextUrl.pathname },
    { status },
  );
}

async function proxy(req: NextRequest, { params }: { params: Params }) {
  const { path } = await params;
  const url = new URL(`/api/v1/${path.join('/')}`, BACKEND);

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.text() : undefined;

  // One bounded attempt, never retried here: a write may already have been applied, so repeating it is not safe.
  // The request is also abandoned if the browser goes away.
  let upstream: Response;
  let data: ArrayBuffer | null = null;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(STAFF_PROXY_UPSTREAM_TIMEOUT_MS)]);
  try {
    upstream = await fetch(url.toString(), { method: req.method, headers, body, signal });
    // The timeout also covers reading the body, so a stalled response cannot hang the proxy after the headers arrive.
    if (!NO_BODY_STATUSES.has(upstream.status)) data = await upstream.arrayBuffer();
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return timedOut
      ? failure(req, 504, 'The service took too long to respond', 'UPSTREAM_TIMEOUT')
      : failure(req, 502, 'Service unavailable', 'UPSTREAM_UNAVAILABLE');
  }

  // 204, 205 and 304 must not carry a body: the Fetch API refuses to build such
  // a response from one (even an empty ArrayBuffer) and the proxy would answer
  // 500 for a request the backend handled. Forward the status with a null body
  // and only the end-to-end headers that mean something without one (no
  // hop-by-hop headers such as Connection or Transfer-Encoding).
  if (NO_BODY_STATUSES.has(upstream.status)) {
    const headers = new Headers();
    for (const name of NO_BODY_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(null, { status: upstream.status, headers });
  }

  return new NextResponse(data, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
