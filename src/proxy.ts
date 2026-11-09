import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { isPublicPath } from '@/lib/route-access';
import { signInUrl } from '@/lib/auth/return-path';

/**
 * Staff route protection. A request without the staff `token` cookie is sent to
 * /login unless the path is public (see src/lib/route-access.ts): the staff
 * entry points always, and the storefront ("/", "/combos...") only while
 * STOREFRONT_ENABLED=true. With the flag off nothing changes from before.
 *
 * This only gates PAGES. Route handlers and the BFF enforce their own checks:
 * a Proxy matcher is not a security boundary for them.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  if (!token && !isPublicPath(pathname, { storefrontEnabled: isStorefrontEnabled() })) {
    // The page they asked for is remembered (validated as an in-app path) so sign-in can return them to it.
    return NextResponse.redirect(new URL(signInUrl({ returnTo: `${pathname}${request.nextUrl.search}` }), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)',
  ],
};
