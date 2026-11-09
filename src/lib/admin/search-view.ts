import type { AppError } from '../errors/app-error.ts';

export type SearchView = 'idle' | 'loading' | 'error' | 'empty' | 'results';

/**
 * What the search dropdown shows. A failed search is its own view: it is never "no results", and it never shows the
 * results of an earlier query as if they answered the current one.
 */
export function searchView(state: { query: string; loading: boolean; error: AppError | null; resultCount: number }): SearchView {
  if (state.query.trim().length < 2) return 'idle';
  if (state.loading) return 'loading';
  if (state.error) return 'error';
  return state.resultCount === 0 ? 'empty' : 'results';
}
