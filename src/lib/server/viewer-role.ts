/**
 * Which staff role, if any, the visitor's staff `token` cookie carries. This is
 * a DISPLAY hint only (the storefront header shows an admin or staff link
 * instead of the customer "Sign in"). It does not verify the signature and
 * grants nothing: every staff page and every API call still enforces access
 * itself. A missing, malformed, expired or unknown-role token is simply "none".
 */
export type StaffRole = 'admin' | 'staff';

const ROLES: readonly string[] = ['admin', 'staff'];

export function staffRoleFromToken(token: string | undefined, nowSeconds: number = Math.floor(Date.now() / 1000)): StaffRole | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload === null || typeof payload !== 'object') return null;
  const { role, exp } = payload as { role?: unknown; exp?: unknown };
  if (typeof exp === 'number' && exp <= nowSeconds) return null;
  return typeof role === 'string' && ROLES.includes(role) ? (role as StaffRole) : null;
}
