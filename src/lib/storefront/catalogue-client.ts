/**
 * Server-side catalogue access through the customer BFF.
 *
 * Pages call the BFF's request handler in-process rather than making an HTTP
 * request back into the same Next.js server: same flag check, same path
 * allowlist, same signed visitor IP, same `no-store`, without a pointless
 * network hop. Nothing reaches the backend except `storefront/combos[/slug]`
 * GETs, and no staff credential or browser Authorization header is involved.
 *
 * The transport is injected (`handle`), so tests run it against the real
 * handler with a fake backend. Relative imports only (node:test loads this).
 */
import type { PublicCombo, PublicComboList } from '../../types/storefront.ts';
import { catalogueQuery, isValidSlug, parseComboList, parsePublicCombo } from './catalogue.ts';

export type FailureKind = 'disabled' | 'not_found' | 'rate_limited' | 'unavailable' | 'error';

export type CatalogueResult<T> = { ok: true; data: T } | { ok: false; kind: FailureKind; status: number };

/** `segments` is what follows /api/store/ ; `query` includes the leading "?" or is empty. */
export type StoreHandle = (segments: string[], query: string) => Promise<Response>;

function failure(status: number): CatalogueResult<never> {
  if (status === 404) return { ok: false, kind: 'not_found', status };
  if (status === 429) return { ok: false, kind: 'rate_limited', status };
  if (status === 503 || status === 502 || status === 504) return { ok: false, kind: 'unavailable', status };
  return { ok: false, kind: 'error', status };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function fetchComboList(
  handle: StoreHandle,
  input: { page?: number; limit?: number; q?: string },
): Promise<CatalogueResult<PublicComboList>> {
  let response: Response;
  try {
    response = await handle(['storefront', 'combos'], catalogueQuery(input));
  } catch {
    return { ok: false, kind: 'unavailable', status: 0 };
  }
  if (!response.ok) return failure(response.status);
  const parsed = parseComboList(await readJson(response));
  return parsed ? { ok: true, data: parsed } : { ok: false, kind: 'error', status: response.status };
}

export async function fetchComboBySlug(handle: StoreHandle, slug: string): Promise<CatalogueResult<PublicCombo>> {
  // The same rule the API applies; an impossible slug never leaves the server.
  if (!isValidSlug(slug)) return { ok: false, kind: 'not_found', status: 404 };
  let response: Response;
  try {
    response = await handle(['storefront', 'combos', slug], '');
  } catch {
    return { ok: false, kind: 'unavailable', status: 0 };
  }
  if (!response.ok) return failure(response.status);
  const parsed = parsePublicCombo(await readJson(response));
  return parsed ? { ok: true, data: parsed } : { ok: false, kind: 'error', status: response.status };
}
