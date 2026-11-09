/**
 * The one answer to "may this person see this page yet?". Every staff guard uses it, so they cannot disagree.
 *  - loading: the browser has not yet read the saved session, so nothing is known (never show sign-in or content)
 *  - unauthenticated: no session: go to sign-in
 *  - forbidden: signed in, but the role does not fit: say so, and stay signed in
 *  - allowed: show the page
 */
export type AccessStatus = 'loading' | 'unauthenticated' | 'forbidden' | 'allowed';

export function resolveAccess(input: {
  hydrated: boolean;
  isAuthenticated: boolean;
  role?: string | null;
  requiredRole?: string;
}): AccessStatus {
  if (!input.hydrated) return 'loading';
  if (!input.isAuthenticated) return 'unauthenticated';
  if (input.requiredRole && input.role !== input.requiredRole) return 'forbidden';
  return 'allowed';
}
