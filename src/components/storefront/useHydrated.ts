'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
/** false during server render and hydration, true afterwards (so stored data never causes a mismatch). */
export const useHydrated = (): boolean => useSyncExternalStore(subscribe, () => true, () => false);
