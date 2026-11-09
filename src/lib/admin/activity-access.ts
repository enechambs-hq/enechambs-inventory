/**
 * Who may read the activity log. This mirrors the API (`/activity-logs/*` is ADMIN-only); it is a courtesy for the
 * interface, not a security boundary: the API refuses everyone else regardless of what the screen shows.
 */
export const canViewActivity = (role: string | null | undefined): boolean => role === 'admin';

export const ACTIVITY_ADMIN_ONLY_MESSAGE = 'Recent activity is available to administrators only.';
