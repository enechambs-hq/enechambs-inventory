/**
 * Where to send someone after they sign in again. The value travels in the address bar (?next=), so it is untrusted input:
 * only a plain in-app path is accepted, never another site, and never the sign-in pages themselves. Pure (no browser or
 * Node APIs) so the edge proxy, the browser and the tests can all use it.
 */
const MAX_LENGTH = 512;
const AUTH_PAGES = ['/login', '/setup-password'];

export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null;
  // One leading slash only: "//host", "/\host" and "http://host" would all leave the site.
  if (raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return null;
  // No backslashes, control characters or whitespace anywhere (browsers treat some of these as slashes or strip them).
  if (/[\\\u0000-\u001f\u007f\s]/.test(raw)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // The same checks again after decoding, so "%2F%2Fhost" and "%5C" cannot sneak through.
  if (decoded[1] === '/' || decoded[1] === '\\' || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  const path = raw.split(/[?#]/)[0];
  if (AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}

export const SESSION_EXPIRED_REASON = 'expired';

/** The sign-in address for someone who must sign in again, remembering where they were. */
export function signInUrl(options: { returnTo?: unknown; expired?: boolean } = {}): string {
  const params = new URLSearchParams();
  const next = safeReturnPath(options.returnTo);
  if (next) params.set('next', next);
  if (options.expired) params.set('reason', SESSION_EXPIRED_REASON);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
