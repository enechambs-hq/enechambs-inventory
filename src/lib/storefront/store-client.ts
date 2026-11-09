/**
 * The browser's only door to the customer API: same-origin `fetch` to the
 * customer BFF (`/api/store/...`). It holds no token. The session is the
 * HttpOnly `ene_cust` cookie, which JavaScript cannot read and the BFF turns
 * into the Authorization header server-side; the browser never sends one.
 *
 * Imports no staff code (axios client, stores, services): the separation test
 * enforces it. The transport is injected so tests run it without a browser.
 */
import { reportApiFailure } from '../monitoring/report.ts';

export type StoreFailureKind = 'unauthenticated' | 'validation' | 'conflict' | 'not_found' | 'rate_limited' | 'unavailable' | 'error';

export interface StoreFailure {
  ok: false;
  kind: StoreFailureKind;
  status: number;
  /** Machine-readable code from the API when it sent one (e.g. INSUFFICIENT_STOCK). */
  code?: string;
  message: string;
  /** The correlation id (X-Request-ID) of the failed exchange, when the response carried one. */
  requestId?: string;
}
export type StoreResult<T> = { ok: true; status: number; data: T } | StoreFailure;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function kindOf(status: number): StoreFailureKind {
  if (status === 401) return 'unauthenticated';
  if (status === 400 || status === 422) return 'validation';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 0 || status === 502 || status === 503 || status === 504) return 'unavailable';
  return 'error';
}

/** The API's `message` may be a string or a list of validation messages; show at most the first few. */
export function messageOf(body: unknown, status: number): string {
  const raw = (body as { message?: unknown } | null)?.message;
  if (typeof raw === 'string' && raw.trim()) return raw.slice(0, 300);
  if (Array.isArray(raw)) {
    const parts = raw.filter((m): m is string => typeof m === 'string').slice(0, 3);
    if (parts.length) return parts.join('. ').slice(0, 300);
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (kindOf(status) === 'unavailable') return 'We could not reach the service. Please try again.';
  return 'Something went wrong. Please try again.';
}

export interface StoreRequest<T> {
  /** Path after /api/store/, e.g. "storefront/orders" or "auth/login". */
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  parse: (json: unknown) => T | null;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}

export async function storeRequest<T>(req: StoreRequest<T>): Promise<StoreResult<T>> {
  const fetcher: Fetcher = req.fetcher ?? ((input, init) => fetch(input, init));
  const method = req.method ?? 'GET';
  let response: Response;
  try {
    response = await fetcher(`/api/store/${req.path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: method === 'GET' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: method === 'GET' || req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: req.signal,
    });
  } catch {
    return { ok: false, kind: 'unavailable', status: 0, message: messageOf(null, 0) };
  }
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    const code = (json as { code?: unknown } | null)?.code;
    // Monitoring: server faults only (status >= 500); never the body, cookies or query string.
    reportApiFailure({
      status: response.status,
      method,
      url: `/api/store/${req.path}`,
      code: typeof code === 'string' ? code : undefined,
      requestId: response.headers?.get?.('x-request-id') ?? (json as { requestId?: string } | null)?.requestId,
      source: 'storefront',
    });
    return {
      ok: false,
      kind: kindOf(response.status),
      status: response.status,
      code: typeof code === 'string' ? code : undefined,
      message: messageOf(json, response.status),
      ...requestIdOf(response, json),
    };
  }
  const data = req.parse(json);
  if (data === null) return { ok: false, kind: 'error', status: response.status, message: 'Unexpected response from the server.' };
  return { ok: true, status: response.status, data };
}

/** The correlation id from the header or the body; only a well-formed one is kept. */
function requestIdOf(response: Response, json: unknown): { requestId?: string } {
  const header = response.headers?.get?.('x-request-id');
  const body = (json as { requestId?: unknown } | null)?.requestId;
  const id = [header, body].find((v) => typeof v === 'string' && /^[A-Za-z0-9._:-]{6,80}$/.test(v));
  return id ? { requestId: id as string } : {};
}

/** Friendly wording for the API's refusal codes; unknown codes fall back to the API's own message. */
const CODE_MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'One of the combos in your cart has just run low or sold out. Please review your cart.',
  COMBO_UNAVAILABLE: 'A combo in your cart is no longer available. Please review your cart.',
  QUANTITY_LIMIT: 'You have more of one combo than we can sell in a single order. Please lower the quantity.',
  ORDER_QUANTITY_LIMIT: 'Your cart is over the limit for a single order. Please reduce the items.',
  DUPLICATE_LINE: 'A combo appears twice in your cart. Please review your cart.',
  TOO_MANY_OPEN_ORDERS: 'You already have unpaid orders. Please pay for or cancel one in My orders first.',
  ORDER_NOT_PAYABLE: 'This order can no longer be paid for. Its payment window may have ended.',
  ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled.',
  PAYMENT_PROVIDER_UNAVAILABLE: 'We could not reach the payment provider. Your order is saved; you can try paying again from My orders.',
  PAYMENTS_DISABLED: 'Online payment is not available right now. Please try again later.',
  TOO_MANY_ADDRESSES: 'Your address book is full. Remove an address to add another.',
  ADDRESS_NOT_FOUND: 'That address could not be found. Please choose another.',
};

export function friendlyMessage(failure: StoreFailure): string {
  if (failure.code && CODE_MESSAGES[failure.code]) return CODE_MESSAGES[failure.code];
  if (failure.kind === 'unauthenticated') return 'Please sign in to continue.';
  return failure.message;
}
