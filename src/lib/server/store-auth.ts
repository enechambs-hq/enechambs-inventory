/**
 * Customer session handling for the BFF (storefront M3).
 *
 * The API returns an `accessToken` from login and email verification. It is a
 * bearer credential, so it must never be readable by page JavaScript. These
 * handlers call the API on the SERVER, move the token into the HttpOnly
 * `ene_cust` cookie, and return the rest of the response to the browser
 * without it.
 *
 * Reuses handleStoreRequest for everything else (feature flag, path allowlist,
 * Origin/CSRF check, JSON-only bodies, bounded body read, signed client IP,
 * header allowlist, cookie-derived Authorization): the browser's own
 * Authorization header is still ignored. Web-standard APIs only, so it is
 * tested with plain Request objects (tests/store-auth.test.mts).
 *
 * Staff authentication is not involved: the staff `token` cookie, localStorage
 * and /api/v1 proxy are neither read nor written here.
 */
import { CUSTOMER_COOKIE, sanitizeBearerToken } from './bff.ts';
import { handleStoreRequest, type StoreBffDeps } from './store-bff.ts';

export type SessionAction = 'login' | 'verify-email' | 'logout';

const BACKEND_SEGMENTS: Record<SessionAction, string[]> = {
  login: ['storefront', 'auth', 'login'],
  'verify-email': ['storefront', 'auth', 'verify-email'],
  logout: ['storefront', 'auth', 'logout'],
};

const DEFAULT_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const MAX_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** '30m' / '12h' / '7d' (the API's CUSTOMER_JWT_EXPIRES_IN format) to seconds. */
export function parseLifetime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return null;
  const seconds = Number(m[1]) * UNITS[m[2]];
  return seconds > 0 ? seconds : null;
}

/** The `exp` claim of a JWT, read WITHOUT verifying it (cookie lifetime only). */
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Cookie lifetime in seconds, so the cookie never outlives (or is cut shorter
 * than) the token it carries, or `null` when the token must not be stored.
 *
 * - The token carries a numeric `exp`: that is authoritative. If no positive
 *   lifetime remains, the token is already dead and the answer is `null`; the
 *   reported `expiresIn` is NOT consulted (it would resurrect a dead token as a
 *   live-looking cookie).
 * - No readable numeric `exp`: the lifetime the API reported (`expiresIn`, the
 *   configured CUSTOMER_JWT_EXPIRES_IN), else seven days.
 * Capped at 30 days.
 */
export function cookieMaxAgeSeconds(
  token: string,
  expiresIn: unknown,
  nowMs: number = Date.now(),
): number | null {
  const exp = tokenExpiry(token);
  let seconds: number;
  if (exp !== null) {
    seconds = Math.floor(exp - nowMs / 1000);
    if (!(seconds > 0)) return null;
  } else {
    seconds = parseLifetime(expiresIn) ?? DEFAULT_LIFETIME_SECONDS;
  }
  return Math.min(seconds, MAX_LIFETIME_SECONDS);
}

const isProduction = (env: Record<string, string | undefined>) =>
  env.NODE_ENV === 'production';

/**
 * `Set-Cookie` value for the customer session. HttpOnly, SameSite=Lax, Path=/,
 * Secure in production. No Domain attribute: the cookie is host-only, so it is
 * never sent to sibling subdomains.
 */
export function buildSessionCookie(
  token: string,
  maxAgeSeconds: number,
  env: Record<string, string | undefined>,
): string {
  return [
    `${CUSTOMER_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
    ...(isProduction(env) ? ['Secure'] : []),
  ].join('; ');
}

/** Expires the cookie. Same name, Path and (absent) Domain as it was set with. */
export function buildClearCookie(env: Record<string, string | undefined>): string {
  return [
    `${CUSTOMER_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ...(isProduction(env) ? ['Secure'] : []),
  ].join('; ');
}

const noStore = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function jsonResponse(body: unknown, status: number, cookie?: string): Response {
  const headers = new Headers({ ...noStore, 'content-type': 'application/json' });
  // Only ever a cookie this module built. An upstream Set-Cookie is never
  // copied: the response below is constructed from scratch.
  if (cookie) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Login and email verification: forward, and on success convert the returned
 * token into the cookie. Logout: forward, then clear the cookie.
 */
export async function handleStoreSessionRequest(
  req: Request,
  action: SessionAction,
  deps: StoreBffDeps,
): Promise<Response> {
  // Remember whether the API was actually contacted. A request refused by the
  // BFF itself (bad Origin, flag off, oversize body...) must not change the
  // session cookie: a forged cross-site request cannot log the visitor out.
  let reachedBackend = false;
  const tracked: StoreBffDeps = {
    ...deps,
    fetch: ((...args: Parameters<typeof fetch>) => {
      reachedBackend = true;
      return deps.fetch(...args);
    }) as typeof fetch,
  };

  const upstream = await handleStoreRequest(req, BACKEND_SEGMENTS[action], tracked, {
    allowSessionRoutes: true,
  });

  if (action === 'logout') {
    const clear = reachedBackend ? buildClearCookie(deps.env) : undefined;
    // The backend revokes the token (401 means it was already invalid). Either
    // way the browser loses the cookie. Other statuses (5xx, 429...) are passed
    // through so the caller knows revocation may not have happened, but the
    // cookie is still cleared: the visitor asked to be signed out.
    const ok = upstream.status === 200 || upstream.status === 401;
    return reachedBackend
      ? jsonResponse(
          ok ? { message: 'Signed out' } : await safeJson(upstream),
          ok ? 200 : upstream.status,
          clear,
        )
      : upstream;
  }

  // login / verify-email
  let parsed: Record<string, unknown> | null = null;
  try {
    const value: unknown = JSON.parse(await upstream.clone().text());
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  const token =
    upstream.status >= 200 && upstream.status < 300 && parsed
      ? sanitizeBearerToken(
          typeof parsed.accessToken === 'string' ? parsed.accessToken : undefined,
        )
      : null;

  if (!token || !parsed) {
    // Failure (wrong code, bad credentials, validation, throttle...): relay the
    // API's answer minus anything token-shaped, and set NO cookie.
    const body = parsed ? withoutToken(parsed) : { message: 'Unexpected response' };
    const status = upstream.status >= 200 && upstream.status < 300 ? 502 : upstream.status;
    const response = jsonResponse(body, status);
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) response.headers.set('retry-after', retryAfter);
    return response;
  }

  const maxAge = cookieMaxAgeSeconds(token, parsed.expiresIn);
  if (maxAge === null) {
    // The API issued a token that is already expired: a session that cannot
    // work. Set no cookie and report a safe error; the token is not relayed.
    return jsonResponse({ message: 'Unable to start a session. Please try again.' }, 502);
  }
  return jsonResponse(
    withoutToken(parsed),
    upstream.status,
    buildSessionCookie(token, maxAge, deps.env),
  );
}

/** Everything the API returned except the token (and its type label). */
function withoutToken(body: Record<string, unknown>): Record<string, unknown> {
  const { accessToken: _t, tokenType: _y, ...rest } = body;
  return rest;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    const v: unknown = JSON.parse(await res.text());
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return withoutToken(v as Record<string, unknown>);
    }
  } catch {
    // fall through
  }
  return { message: 'Service unavailable' };
}
