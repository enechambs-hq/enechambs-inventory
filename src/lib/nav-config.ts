/**
 * Sidebar link definitions, separated from rendering so role visibility can be
 * tested. Icons stay in Sidebar.tsx, keyed by href. The order and membership of
 * the existing links are unchanged; "Promotions" is the only addition and is
 * ADMIN-ONLY (the backend independently answers 403 to staff).
 */

export interface NavLinkDef {
  href: string;
  label: string;
}

export const STAFF_LINKS: NavLinkDef[] = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/sales', label: 'Sales' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/categories', label: 'Categories' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/stock-alerts', label: 'Stock Alerts' },
  { href: '/reports', label: 'Reports' },
];

export const ADMIN_LINKS: NavLinkDef[] = [
  { href: '/dashboard', label: 'Dashboard' },
  ...STAFF_LINKS,
  { href: '/purchases', label: 'Purchases' },
  { href: '/customers', label: 'Customers' },
  { href: '/promotions/combos', label: 'Promotions' },
  { href: '/users', label: 'Users' },
];

export const PROMOTIONS_HREF = '/promotions/combos';

/** Only the literal string 'admin' sees admin links; anything else (staff, unknown, signed out) sees the staff set. */
export const linksForRole = (role: string | null | undefined): NavLinkDef[] =>
  role === 'admin' ? ADMIN_LINKS : STAFF_LINKS;

export const canManagePromotions = (role: string | null | undefined): boolean => role === 'admin';

/** Active-link rule: nested routes (/promotions/combos/new) keep their section highlighted. */
export const isLinkActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);
