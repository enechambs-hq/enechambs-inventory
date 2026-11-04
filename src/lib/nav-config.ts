/**
 * Sidebar link definitions, separated from rendering so role visibility can be
 * tested. Icons stay in Sidebar.tsx, keyed by href. The order and membership of
 * the existing links are unchanged. Additions: "Promotions" (ADMIN-ONLY),
 * "Online Orders" (staff and admin; the separate online sales channel, kept
 * apart from in-store "Sales") and "Online Reports" (ADMIN-ONLY, storefront
 * collections). The backend independently answers 403 to staff for admin routes.
 */

export interface NavLinkDef {
  href: string;
  label: string;
}

export const STAFF_LINKS: NavLinkDef[] = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/sales', label: 'Sales' },
  { href: '/storefront-orders', label: 'Online Orders' },
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
  { href: '/storefront-reports', label: 'Online Reports' },
  { href: '/users', label: 'Users' },
];

export const PROMOTIONS_HREF = '/promotions/combos';
export const STOREFRONT_REPORTS_HREF = '/storefront-reports';
export const STOREFRONT_ORDERS_HREF = '/storefront-orders';

/** Only the literal string 'admin' sees admin links; anything else (staff, unknown, signed out) sees the staff set. */
export const linksForRole = (role: string | null | undefined): NavLinkDef[] =>
  role === 'admin' ? ADMIN_LINKS : STAFF_LINKS;

export const canManagePromotions = (role: string | null | undefined): boolean => role === 'admin';

/** Storefront collections and every financial decision: administrators only. */
export const canViewStorefrontReports = (role: string | null | undefined): boolean => role === 'admin';
export const canDecideStorefrontPayments = (role: string | null | undefined): boolean => role === 'admin';
/** Viewing online orders and moving paid ones through fulfilment: staff and administrators. */
export const canManageOnlineOrders = (role: string | null | undefined): boolean => role === 'admin' || role === 'staff';

/** Active-link rule: nested routes (/promotions/combos/new) keep their section highlighted. */
export const isLinkActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);
