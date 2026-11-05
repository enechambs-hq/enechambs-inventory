/**
 * Which paths may be opened without a staff token. Pure so it can be tested;
 * src/proxy.ts is the only caller.
 *
 * Matching is by whole path segment: "/login" and "/login/..." match, but
 * "/login-extra" and "/loginx" do not (the previous startsWith() check made
 * those public by accident). Anything not listed requires the staff token, so
 * a new route is protected by default.
 */

/** Staff entry points: always public. */
export const STAFF_PUBLIC_SECTIONS = ['/login', '/setup-password'] as const;

/**
 * Storefront sections, public ONLY while STOREFRONT_ENABLED=true. "/" is matched exactly.
 * /checkout, /account and /my-orders are public SHELLS: the staff proxy has no
 * say over customers. What they show is protected where it matters, by the
 * customer session (cookie -> BFF -> API ownership checks), never by this list.
 */
export const STOREFRONT_PUBLIC_SECTIONS = ['/combos', '/cart', '/checkout', '/account', '/my-orders'] as const;

const inSection = (pathname: string, section: string): boolean =>
  pathname === section || pathname.startsWith(`${section}/`);

export function isPublicPath(pathname: string, options: { storefrontEnabled: boolean }): boolean {
  if (STAFF_PUBLIC_SECTIONS.some((s) => inSection(pathname, s))) return true;
  if (!options.storefrontEnabled) return false;
  if (pathname === '/') return true;
  return STOREFRONT_PUBLIC_SECTIONS.some((s) => inSection(pathname, s));
}
