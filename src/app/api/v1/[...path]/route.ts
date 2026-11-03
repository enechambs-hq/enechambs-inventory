import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.BACKEND_URL ?? 'https://enechambs-api.onrender.com';

type Params = Promise<{ path: string[] }>;

const NO_BODY_STATUSES = new Set([204, 205, 304]);
const NO_BODY_HEADERS = ['content-type', 'etag', 'cache-control', 'last-modified'];

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

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

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

  const data = await upstream.arrayBuffer();
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
