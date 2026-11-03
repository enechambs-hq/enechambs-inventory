/**
 * Promotional combo types. They mirror the backend response DTOs in
 * enechambs-api `src/promotions/dto/*` (docs/PROMOTIONS_API.md). Nothing here
 * is invented: every property below is returned by the admin API.
 */

export type ComboStatus = 'draft' | 'published' | 'unpublished';

export interface ComboImage {
  id: string;
  /** Public URL derived by the server. null when the server has no public media base URL. */
  url: string | null;
  altText: string;
  displayOrder: number;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ComboAvailability {
  status: string;
  /** Exactly what a customer would be shown. */
  label: string;
  remaining?: number;
}

/**
 * One line of "What's included in this combo?". Free text (no unit list), so
 * local packaging such as "1 derica" works. quantityLabel is null when no
 * quantity was specified. Mirrors the API's { name, quantityLabel }.
 */
export interface ComboItem {
  name: string;
  quantityLabel: string | null;
}

export interface Combo {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** What the package contains, in the order entered. Empty only for combos created before contents existed. */
  items: ComboItem[];
  /** Naira. */
  price: number;
  referencePrice: number | null;
  totalQuantity: number;
  /** Units still available to customers. Server-managed. */
  remainingQuantity: number;
  /** total - remaining. Server-derived. */
  allocatedQuantity: number;
  /** Server-managed; changes only through publish / unpublish. */
  status: ComboStatus;
  customerAvailability: ComboAvailability;
  images: ComboImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ComboListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ComboListResponse {
  data: Combo[];
  meta: ComboListMeta;
}

export interface ListCombosParams {
  page?: number;
  limit?: number;
  status?: ComboStatus | '';
  /** Matches name or slug. */
  q?: string;
}

/** Fields the backend accepts on create. Never includes status or remaining stock. */
export interface CreateComboPayload {
  name: string;
  slug?: string;
  description?: string;
  /** At least one, at most 50, in display order. */
  items: ComboItem[];
  price: number;
  referencePrice?: number;
  totalQuantity: number;
}

/** Fields the backend accepts on edit. referencePrice: null clears it. */
export interface UpdateComboPayload {
  name?: string;
  slug?: string;
  description?: string;
  /** Replaces the whole list; omitted when unchanged. */
  items?: ComboItem[];
  price?: number;
  referencePrice?: number | null;
  totalQuantity?: number;
}

export interface PresignResponse {
  /** Pass to confirm. Not the storage key. */
  uploadId: string;
  uploadUrl: string;
  method: 'PUT';
  /** The headers the browser must send with the PUT. */
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}
