import { cache } from 'react';
import { headers } from 'next/headers';
import { handleStoreRequest } from '@/lib/server/store-bff';
import {
  fetchComboBySlug,
  fetchComboList,
  type StoreHandle,
} from '@/lib/storefront/catalogue-client';

/**
 * Wires the catalogue client to the customer BFF handler for Server
 * Components. Only the two headers the BFF reads to work out the visitor's
 * address are carried over (it honours them only on Vercel, see
 * docs/STOREFRONT_ROUTING.md); cookies and Authorization are deliberately NOT
 * forwarded, so a staff session can never act as customer authentication.
 */
async function handle(segments: string[], query: string): Promise<Response> {
  const incoming = await headers();
  const forwarded = new Headers();
  for (const name of ['x-vercel-forwarded-for', 'x-forwarded-for']) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  const request = new Request(`http://storefront.internal/api/store/${segments.join('/')}${query}`, {
    method: 'GET',
    headers: forwarded,
  });
  return handleStoreRequest(request, segments, { env: process.env, fetch });
}

const transport: StoreHandle = handle;

export const getComboList = (input: { page?: number; limit?: number; q?: string }) =>
  fetchComboList(transport, input);

/** Deduplicated per request, so generateMetadata and the page share one call. */
export const getComboBySlug = cache((slug: string) => fetchComboBySlug(transport, slug));
