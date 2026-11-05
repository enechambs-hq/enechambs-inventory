'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query currently matches, kept up to date as the window
 * changes. False on the server and during hydration, so a page that depends on
 * it must not render anything different there that matters (checkout renders
 * only after the client has loaded).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
