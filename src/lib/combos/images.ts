/** Pure helpers for the image list: ordering and the "removal verified" check. */
import type { ComboImage } from '../../types/combos.ts';

export const sortImages = (images: ComboImage[]): ComboImage[] =>
  [...images].sort((a, b) => a.displayOrder - b.displayOrder);

/** New order of image ids after moving the image at `index` by `delta` (-1 up, +1 down). */
export function moveImage(ids: string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Decides whether a failed DELETE actually removed the image.
 *
 * Why this exists: the backend answers 204 No Content, and the existing admin
 * proxy (`src/app/api/v1/[...path]/route.ts`) builds its response from the
 * upstream body, which throws for a 204 in the Fetch API. So the browser sees
 * a 5xx even though the backend deleted the image. This milestone must not
 * change the proxy, so on an ambiguous failure (5xx, or no response) the UI
 * re-reads the combo and treats the image as removed only if it is really
 * gone. A definite answer from the backend (4xx, e.g. 409 "a published combo
 * must keep at least one image") is never second-guessed.
 */
export const isAmbiguousFailure = (status: number | null): boolean => status === null || status >= 500;

export const imageIsGone = (combo: { images: Array<{ id: string }> }, imageId: string): boolean =>
  !combo.images.some((i) => i.id === imageId);
