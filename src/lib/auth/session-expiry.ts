import { signInUrl } from './return-path.ts';

/**
 * What a 401 from the staff API means. Only a rejected staff token is an expired session: a wrong password on the sign-in
 * form, a wrong current password when changing it, or a request that never carried the current token is not, and must stay
 * an ordinary error for the page that made it. A 403 is never handled here: it means "signed in but not allowed" and must
 * not sign anyone out.
 */
const NOT_SESSION_ENDPOINTS = ['/auth/login', '/auth/setup-password', '/auth/validate-token', '/auth/change-password', '/auth/logout'];
const PUBLIC_PAGES = ['/login', '/setup-password'];

export interface FailedStaffRequest {
  status?: number;
  /** The request URL as given to the HTTP client (relative to the API base). */
  url?: string;
  /** The Authorization header the request was sent with. */
  authorization?: string | null;
}

export function isSessionExpiry(
  failed: FailedStaffRequest,
  current: { token: string | null; pathname: string },
): boolean {
  if (failed.status !== 401) return false;
  const path = (failed.url ?? '').split('?')[0];
  if (NOT_SESSION_ENDPOINTS.some((e) => path === e || path.endsWith(e))) return false;
  // The session must be one we hold and the very one the request was sent with: a late 401 for an old token must not
  // sign out a newer sign-in, and a request sent without a token tells us nothing about the current session.
  if (!current.token || failed.authorization !== `Bearer ${current.token}`) return false;
  // On the sign-in pages there is no signed-in screen to leave.
  if (PUBLIC_PAGES.some((p) => current.pathname === p || current.pathname.startsWith(`${p}/`))) return false;
  return true;
}

export interface SessionExpiryDeps {
  getToken: () => string | null;
  /** The one session cleanup (the store's clearAuth). Returns false if a saved credential could not be removed. */
  clearLocal: () => boolean | void;
  /** Leaves the page for the given address (a full navigation, which also abandons requests still in flight). */
  navigate: (url: string) => void;
  location: () => { pathname: string; search: string };
}

/**
 * Handles an expired staff session exactly once, however many requests report it at the same moment: the first 401 clears
 * the session and navigates; the rest, which carry the same token, are ignored. A new sign-in has a new token and is handled afresh.
 */
export function createSessionExpiry(deps: SessionExpiryDeps) {
  // The token whose expiry has been handled. A later sign-in has a different token, so it is handled afresh.
  let handledToken: string | null = null;
  return {
    /** Returns true only for the failure that triggered the cleanup; later or unrelated failures return false. */
    handle(failed: FailedStaffRequest): boolean {
      const here = deps.location();
      const token = deps.getToken();
      if (token !== null && token === handledToken) return false;
      if (!isSessionExpiry(failed, { token, pathname: here.pathname })) return false;
      handledToken = token;
      try {
        deps.clearLocal();
      } catch {
        /* the sign-in page reports a credential that remains */
      }
      deps.navigate(signInUrl({ returnTo: `${here.pathname}${here.search}`, expired: true }));
      return true;
    },
    /** Forgets what was handled (tests; a sign-in with a new token does not need it). */
    reset() {
      handledToken = null;
    },
  };
}
