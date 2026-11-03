/** Limits that mirror the backend (enechambs-api `promotions.constants.ts` and the DTOs). */

export const MAX_IMAGES_PER_COMBO = 8;
export const MAX_COMBO_QUANTITY = 100_000;
export const MAX_COMBO_PRICE = 100_000_000;
export const MIN_COMBO_PRICE = 0.01;
export const MAX_ALT_TEXT_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const NAME_LENGTH = { min: 2, max: 160 } as const;
export const SLUG_LENGTH = { min: 3, max: 120 } as const;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LIST_PAGE_SIZE = 20;
export const MAX_SEARCH_LENGTH = 100;

/** JPEG, PNG and WebP only. SVG and everything else are refused by the backend. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const COMBO_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Unpublished' },
] as const;
