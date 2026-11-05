import { NextRequest, NextResponse } from 'next/server';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { staffRoleFromToken } from '@/lib/server/viewer-role';

/**
 * Tells the storefront header whether this browser also holds a staff session,
 * so staff are not shown the customer "Sign in". Storefront code never reads
 * cookies; this server handler reads the staff `token` cookie and returns only
 * the role word. A display hint: it authorises nothing.
 */
export function GET(request: NextRequest) {
  if (!isStorefrontEnabled()) return new NextResponse(null, { status: 404 });
  const staffRole = staffRoleFromToken(request.cookies.get('token')?.value);
  return NextResponse.json({ staffRole }, { headers: { 'Cache-Control': 'no-store' } });
}
