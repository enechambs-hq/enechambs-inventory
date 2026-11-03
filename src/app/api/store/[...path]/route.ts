import type { NextRequest } from 'next/server';
import { handleStoreRequest } from '@/lib/server/store-bff';

/**
 * Customer backend-for-frontend: a thin wrapper. All behaviour (flag, path
 * allowlist, CSRF, bounded body read, cookie-derived auth, signed client IP,
 * header allowlist) lives in src/lib/server/store-bff.ts so it can be tested
 * without Next.js. See docs/STOREFRONT_ROUTING.md for the contract.
 *
 * Route Handlers are public HTTP endpoints, so every check is in the handler
 * logic, not in proxy.ts. The existing admin proxy at /api/v1/[...path] is
 * untouched.
 */

type Params = Promise<{ path: string[] }>;

async function handle(req: NextRequest, { params }: { params: Params }) {
  const { path } = await params;
  return handleStoreRequest(req, path, { env: process.env, fetch });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
