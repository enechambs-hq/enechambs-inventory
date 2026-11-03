/** Pure helpers for the image list: ordering. */
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
