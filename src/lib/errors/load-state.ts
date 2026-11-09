import type { AppError } from './app-error.ts';

/**
 * The four honest states of a data load. A failed request is its own state: it is never an empty list.
 */
export type LoadState<T> = { status: 'loading' } | { status: 'error'; error: AppError } | { status: 'success'; data: T };

export const loading = <T>(): LoadState<T> => ({ status: 'loading' });
export const failed = <T>(error: AppError): LoadState<T> => ({ status: 'error', error });
export const loaded = <T>(data: T): LoadState<T> => ({ status: 'success', data });

export type LoadView = 'loading' | 'error' | 'empty' | 'content';

/**
 * Which of the four screens to show. "Empty" can only come from a SUCCESSFUL load whose data has no records.
 * `isEmpty` is page-specific (an empty array, zero rows, ...).
 */
export function viewOf<T>(state: LoadState<T>, isEmpty: (data: T) => boolean): LoadView {
  if (state.status === 'loading') return 'loading';
  if (state.status === 'error') return 'error';
  return isEmpty(state.data) ? 'empty' : 'content';
}
