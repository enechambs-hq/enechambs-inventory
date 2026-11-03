/**
 * What a storefront visitor receives for a combo. Mirrors the backend's
 * PublicComboDto (enechambs-api `docs/PROMOTIONS_API.md`, "Public catalogue").
 * Deliberately has no id, status, total/remaining stock, timestamps or storage
 * details: the API does not send them, and the parser in
 * `src/lib/storefront/catalogue.ts` refuses to carry any extra field through.
 */
export type AvailabilityStatus = 'available' | 'low_stock' | 'sold_out';

export interface PublicAvailability {
  status: AvailabilityStatus;
  /** The label the API wants shown ("Available", "Only 7 left", "Sold Out"). */
  label: string;
  /** Present only for low_stock. */
  remaining?: number;
}

export interface PublicComboImage {
  url: string;
  altText: string;
}

export interface PublicCombo {
  name: string;
  slug: string;
  description: string;
  /** Naira. */
  price: number;
  referencePrice: number | null;
  images: PublicComboImage[];
  availability: PublicAvailability;
}

export interface PublicListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicComboList {
  data: PublicCombo[];
  meta: PublicListMeta;
}
