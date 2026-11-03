/**
 * Pure catalogue helpers: query handling, response parsing, display formatting.
 * Relative imports only so the node:test suite loads this file directly.
 */
import type {
  AvailabilityStatus,
  PublicAvailability,
  PublicCombo,
  PublicComboList,
} from '../../types/storefront.ts';

export const CATALOGUE_PAGE_SIZE = 12;
export const HOME_FEATURED_COUNT = 4;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_PAGE = 10_000;

/** The backend's slug rule (enechambs-api SLUG_PATTERN, at most 120 characters). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isValidSlug = (value: string): boolean => value.length > 0 && value.length <= 120 && SLUG.test(value);

type RawParam = string | string[] | undefined;
const first = (v: RawParam): string | undefined => (Array.isArray(v) ? v[0] : v);

/** ?page=: a whole number from 1; anything else is page 1. */
export function parsePageParam(raw: RawParam): number {
  const text = first(raw);
  if (!text || !/^\d{1,5}$/.test(text)) return 1;
  const n = Number(text);
  return n >= 1 && n <= MAX_PAGE ? n : 1;
}

/** ?q=: trimmed, at most 100 characters; blank is no search. */
export function parseSearchParam(raw: RawParam): string {
  return (first(raw) ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
}

/** Only parameters the public API supports: page, limit, q. */
export function catalogueQuery(input: { page?: number; limit?: number; q?: string }): string {
  const params = new URLSearchParams();
  params.set('page', String(input.page && input.page >= 1 ? input.page : 1));
  params.set('limit', String(input.limit && input.limit >= 1 ? Math.min(input.limit, 48) : CATALOGUE_PAGE_SIZE));
  const q = (input.q ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  if (q) params.set('q', q);
  return `?${params.toString()}`;
}

/** A link back to the catalogue page (page 1 and an empty search are omitted). */
export function catalogueHref(input: { page?: number; q?: string }): string {
  const params = new URLSearchParams();
  const q = (input.q ?? '').trim();
  if (q) params.set('q', q);
  if (input.page && input.page > 1) params.set('page', String(input.page));
  const qs = params.toString();
  return qs ? `/combos?${qs}` : '/combos';
}

const nairaFormat = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatNaira = (n: number): string => `₦${nairaFormat.format(n)}`;

// ── parsing: take only what is public, check every type ─────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const STATUSES: AvailabilityStatus[] = ['available', 'low_stock', 'sold_out'];
const DEFAULT_LABEL: Record<AvailabilityStatus, string> = {
  available: 'Available',
  low_stock: 'Low stock',
  sold_out: 'Sold Out',
};

function parseAvailability(raw: unknown): PublicAvailability | null {
  if (!isObject(raw)) return null;
  const status = raw.status;
  if (typeof status !== 'string' || !(STATUSES as string[]).includes(status)) return null;
  const s = status as AvailabilityStatus;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 60) : DEFAULT_LABEL[s];
  const out: PublicAvailability = { status: s, label };
  // The exact count is shown only when the API says stock is low. Above the
  // threshold it must never appear, even if some other response carried it.
  if (s === 'low_stock' && Number.isInteger(raw.remaining) && (raw.remaining as number) > 0) {
    out.remaining = raw.remaining as number;
  }
  return out;
}

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export function parsePublicCombo(raw: unknown): PublicCombo | null {
  if (!isObject(raw)) return null;
  const { name, slug, description, price, referencePrice } = raw;
  if (typeof name !== 'string' || !name.trim()) return null;
  if (typeof slug !== 'string' || !isValidSlug(slug)) return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
  const availability = parseAvailability(raw.availability);
  if (!availability) return null;

  const images = Array.isArray(raw.images)
    ? raw.images.flatMap((image) => {
        if (!isObject(image) || !isHttpsUrl(image.url)) return [];
        return [{ url: image.url, altText: typeof image.altText === 'string' ? image.altText.slice(0, 200) : '' }];
      })
    : [];

  return {
    name: name.trim(),
    slug,
    description: typeof description === 'string' ? description : '',
    price,
    referencePrice:
      typeof referencePrice === 'number' && Number.isFinite(referencePrice) && referencePrice > 0 ? referencePrice : null,
    images,
    availability,
  };
}

export function parseComboList(raw: unknown): PublicComboList | null {
  if (!isObject(raw) || !Array.isArray(raw.data) || !isObject(raw.meta)) return null;
  const { total, page, limit, totalPages } = raw.meta;
  if (![total, page, limit, totalPages].every((n) => Number.isInteger(n) && (n as number) >= 0)) return null;
  return {
    data: raw.data.flatMap((item) => {
      const combo = parsePublicCombo(item);
      return combo ? [combo] : [];
    }),
    meta: { total: total as number, page: page as number, limit: limit as number, totalPages: totalPages as number },
  };
}

// ── display rules ────────────────────────────────────────────────────────────

/** "Save ₦7,000" when a reference price above the price exists. */
export const savingOf = (combo: Pick<PublicCombo, 'price' | 'referencePrice'>): number | null =>
  combo.referencePrice !== null && combo.referencePrice > combo.price
    ? Math.round((combo.referencePrice - combo.price) * 100) / 100
    : null;

export const isSoldOut = (combo: Pick<PublicCombo, 'availability'>): boolean => combo.availability.status === 'sold_out';
