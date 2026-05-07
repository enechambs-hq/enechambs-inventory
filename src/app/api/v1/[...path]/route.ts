import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'https://enechambs-api.onrender.com';

type Params = Promise<{ path: string[] }>;

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
