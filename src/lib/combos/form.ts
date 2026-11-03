/**
 * Combo form validation. Rules mirror the backend DTOs
 * (enechambs-api `combo-request.dto.ts`); the backend remains the authority.
 *
 * What is deliberately NOT here: remaining quantity, allocated quantity,
 * status. They are server-managed and never appear in a payload.
 */
import type { Combo, CreateComboPayload, UpdateComboPayload } from '../../types/combos.ts';
import {
  MAX_COMBO_PRICE,
  MAX_COMBO_QUANTITY,
  MAX_DESCRIPTION_LENGTH,
  MIN_COMBO_PRICE,
  NAME_LENGTH,
  SLUG_LENGTH,
  SLUG_PATTERN,
} from './constants.ts';

export interface ComboFormValues {
  name: string;
  slug: string;
  description: string;
  price: string;
  referencePrice: string;
  totalQuantity: string;
}

export type ComboFieldErrors = Partial<Record<keyof ComboFormValues, string>>;

export const emptyComboForm = (): ComboFormValues => ({
  name: '',
  slug: '',
  description: '',
  price: '',
  referencePrice: '',
  totalQuantity: '',
});

export const formFromCombo = (combo: Combo): ComboFormValues => ({
  name: combo.name,
  slug: combo.slug,
  description: combo.description ?? '',
  price: String(combo.price),
  referencePrice: combo.referencePrice === null ? '' : String(combo.referencePrice),
  totalQuantity: String(combo.totalQuantity),
});

/** The slug cannot change once published (the backend answers 409). */
export const isSlugFrozen = (combo: Pick<Combo, 'status'> | null): boolean =>
  combo?.status === 'published';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

/** Parses a money string ("25,000", "25000.5"). Blank -> null. Bad -> 'invalid'. */
export function parseMoney(raw: string): number | null | 'invalid' {
  const text = raw.replace(/,/g, '').trim();
  if (text === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid';
  return Number(text);
}

function checkMoney(raw: string, label: string, required: boolean): { value: number | null; error?: string } {
  const parsed = parseMoney(raw);
  if (parsed === null) return required ? { value: null, error: `${label} is required` } : { value: null };
  if (parsed === 'invalid') return { value: null, error: `${label} must be a number with at most 2 decimal places` };
  if (parsed < MIN_COMBO_PRICE) return { value: null, error: `${label} must be at least ${naira(MIN_COMBO_PRICE)}` };
  if (parsed > MAX_COMBO_PRICE) return { value: null, error: `${label} cannot exceed ${naira(MAX_COMBO_PRICE)}` };
  return { value: parsed };
}

function checkQuantity(raw: string, min: number): { value: number | null; error?: string } {
  const text = raw.replace(/,/g, '').trim();
  if (text === '') return { value: null, error: 'Total quantity is required' };
  if (!/^\d+$/.test(text)) return { value: null, error: 'Total quantity must be a whole number' };
  const n = Number(text);
  if (n < min) return { value: null, error: `Total quantity must be at least ${min}` };
  if (n > MAX_COMBO_QUANTITY) {
    return { value: null, error: `Total quantity cannot exceed ${MAX_COMBO_QUANTITY.toLocaleString('en-NG')}` };
  }
  return { value: n };
}

function checkCommon(values: ComboFormValues, errors: ComboFieldErrors) {
  const name = values.name.trim();
  if (name.length < NAME_LENGTH.min || name.length > NAME_LENGTH.max) {
    errors.name = `Name must be ${NAME_LENGTH.min} to ${NAME_LENGTH.max} characters`;
  }
  if (values.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description cannot exceed ${MAX_DESCRIPTION_LENGTH.toLocaleString('en-NG')} characters`;
  }
  const price = checkMoney(values.price, 'Promotional price', true);
  if (price.error) errors.price = price.error;
  const reference = checkMoney(values.referencePrice, 'Reference price', false);
  if (reference.error) errors.referencePrice = reference.error;
  if (
    !errors.price &&
    !errors.referencePrice &&
    price.value !== null &&
    reference.value !== null &&
    reference.value < price.value
  ) {
    errors.referencePrice = 'Reference price cannot be below the promotional price';
  }
  return { name, price: price.value, reference: reference.value };
}

function checkSlug(slug: string, errors: ComboFieldErrors): string {
  const value = slug.trim();
  if (value === '') return '';
  if (value.length < SLUG_LENGTH.min || value.length > SLUG_LENGTH.max) {
    errors.slug = `Slug must be ${SLUG_LENGTH.min} to ${SLUG_LENGTH.max} characters`;
  } else if (!SLUG_PATTERN.test(value)) {
    errors.slug = 'Use lowercase letters and numbers separated by single hyphens (e.g. festive-rice-combo)';
  }
  return value;
}

export type ValidationResult<T> =
  | { ok: true; payload: T }
  | { ok: false; errors: ComboFieldErrors };

export function validateCreate(values: ComboFormValues): ValidationResult<CreateComboPayload> {
  const errors: ComboFieldErrors = {};
  const { name, price, reference } = checkCommon(values, errors);
  const slug = checkSlug(values.slug, errors);
  const quantity = checkQuantity(values.totalQuantity, 1);
  if (quantity.error) errors.totalQuantity = quantity.error;
  if (Object.keys(errors).length || price === null || quantity.value === null) {
    return { ok: false, errors };
  }

  const payload: CreateComboPayload = { name, price, totalQuantity: quantity.value };
  if (slug) payload.slug = slug; // blank: the server generates one from the name
  const description = values.description.trim();
  if (description) payload.description = description;
  if (reference !== null) payload.referencePrice = reference;
  return { ok: true, payload };
}

/**
 * PATCH semantics: only fields that actually changed are sent. That keeps an
 * untouched (and possibly frozen) slug out of the request, and an empty diff
 * is reported as "nothing to save" instead of provoking a 400.
 */
export function validateUpdate(
  values: ComboFormValues,
  original: Combo,
): ValidationResult<UpdateComboPayload> {
  const errors: ComboFieldErrors = {};
  const { name, price, reference } = checkCommon(values, errors);
  const frozen = isSlugFrozen(original);
  const slug = frozen ? original.slug : checkSlug(values.slug, errors);
  if (!frozen && slug === '') errors.slug = 'Slug is required';
  const quantity = checkQuantity(values.totalQuantity, 0);
  if (quantity.error) errors.totalQuantity = quantity.error;
  if (Object.keys(errors).length || price === null || quantity.value === null) {
    return { ok: false, errors };
  }

  const payload: UpdateComboPayload = {};
  if (name !== original.name) payload.name = name;
  if (!frozen && slug !== original.slug) payload.slug = slug;
  if (values.description.trim() !== (original.description ?? '')) payload.description = values.description.trim();
  if (price !== original.price) payload.price = price;
  if (reference !== original.referencePrice) payload.referencePrice = reference; // null clears it
  if (quantity.value !== original.totalQuantity) payload.totalQuantity = quantity.value;
  return { ok: true, payload };
}

export const hasChanges = (payload: UpdateComboPayload): boolean => Object.keys(payload).length > 0;

/** Suggests a slug from a name, as a convenience hint only (the server owns generation). */
export const suggestSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_LENGTH.max);
