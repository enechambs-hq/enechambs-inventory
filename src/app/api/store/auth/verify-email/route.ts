import type { NextRequest } from 'next/server';
import { handleStoreSessionRequest } from '@/lib/server/store-auth';

/**
 * Customer verify-email (storefront M3). A thin wrapper: the behaviour, including moving
 * the API's access token into the HttpOnly `ene_cust` cookie so page
 * JavaScript never sees it, is in src/lib/server/store-auth.ts. This specific
 * route takes precedence over the catch-all at /api/store/[...path], which in
 * any case refuses the session routes. See docs/STOREFRONT_ROUTING.md.
 */
export async function POST(req: NextRequest) {
  return handleStoreSessionRequest(req, 'verify-email', { env: process.env, fetch });
}
