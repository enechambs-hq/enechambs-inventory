'use client';

/**
 * Whether this browser also has a staff or admin session, as reported by the
 * server (`/api/viewer`). The staff token is never read here. Asked again when
 * `revalidateOn` changes (the header outlives navigation).
 */
import { useEffect, useState } from 'react';

export type StaffRoleState = { status: 'loading' } | { status: 'known'; role: 'admin' | 'staff' | null };

export function useStaffRole(revalidateOn?: string): StaffRoleState {
  const [state, setState] = useState<StaffRoleState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/viewer', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { staffRole?: unknown } | null) => {
        if (controller.signal.aborted) return;
        const role = body?.staffRole === 'admin' || body?.staffRole === 'staff' ? body.staffRole : null;
        setState({ status: 'known', role });
      })
      .catch(() => {
        // Aborted or unreachable: treat as "no staff session" so the customer link still shows.
        if (!controller.signal.aborted) setState({ status: 'known', role: null });
      });
    return () => controller.abort();
  }, [revalidateOn]);

  return state;
}
