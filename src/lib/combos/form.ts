/**
 * Combo form validation. Rules mirror the backend DTOs
 * (enechambs-api `combo-request.dto.ts`); the backend remains the authority.
 *
 * What is deliberately NOT here: remaining quantity, allocated quantity,
 * status. They are server-managed and never appear in a payload.
 */
import type { Combo, ComboItem, CreateComboPayload, UpdateComboPayload } from '../../types/combos.ts';
import {
  ITEM_NAME_MAX,
  ITEM_QUANTITY_MAX,
  MAX_COMBO_ITEMS,
  MAX_COMBO_PRICE,
  MAX_COMBO_QUANTITY,
  MAX_DESCRIPTION_LENGTH,
  MIN_COMBO_PRICE,
  NAME_LENGTH,
  SLUG_LENGTH,
  SLUG_PATTERN,
} from './constants.ts';

/**
 * One editable row of "What's included in this combo?". `key` identifies the
 * row for React and for its error messages; it never leaves the browser and is
 * never sent to the API. Because it does not depend on position or content,
 * adding or removing another row cannot make an input take over a neighbour's
 * text.
 */
export interface ItemRow {
  key: string;
  name: string;
  quantityLabel: string;
}

export interface ItemRowErrors {
  name?: string;
  quantityLabel?: string;
}

export interface ComboFormValues {
  name: string;
  slug: string;
  description: string;
  items: ItemRow[];
  price: string;
  referencePrice: string;
  totalQuantity: string;
}

type SimpleFieldKey = Exclude<keyof ComboFormValues, 'items'>;

export interface ComboFieldErrors extends Partial<Record<SimpleFieldKey, string>> {
  /** A problem with the list as a whole (none entered, too many). */
  items?: string;
  /** Problems with individual rows, by ItemRow.key. */
  itemRows?: Record<string, ItemRowErrors>;
}

let rowCounter = 0;
/** A new blank row with a unique, stable key. */
export const newItemRow = (name = '', quantityLabel = ''): ItemRow => ({
  key: `item-${++rowCounter}`,
  name,
  quantityLabel,
});

/** Appends a blank row (no-op at the 50-item limit). Existing rows are untouched. */
export const addItemRow = (rows: ItemRow[]): ItemRow[] =>
  rows.length >= MAX_COMBO_ITEMS ? rows : [...rows, newItemRow()];

/**
 * Removes the row with this key, keeping every other row, its text and its
 * position. The form always shows at least one row: removing the only row
 * leaves a fresh blank one.
 */
export const removeItemRow = (rows: ItemRow[], key: string): ItemRow[] => {
  const kept = rows.filter((row) => row.key !== key);
  return kept.length > 0 ? kept : [newItemRow()];
};

/** Edits one field of one row; order and all other rows are unchanged. */
export const updateItemRow = (
  rows: ItemRow[],
  key: string,
  patch: Partial<Pick<ItemRow, 'name' | 'quantityLabel'>>,
): ItemRow[] => rows.map((row) => (row.key === key ? { ...row, ...patch } : row));

export const emptyComboForm = (): ComboFormValues => ({
  name: '',
  slug: '',
  description: '',
  items: [newItemRow()], // starts with one empty row
  price: '',
  referencePrice: '',
  totalQuantity: '',
});

export const formFromCombo = (combo: Combo): ComboFormValues => ({
  name: combo.name,
  slug: combo.slug,
  description: combo.description ?? '',
  // A combo created before contents existed has none: show one blank row to fill in.
  items: combo.items?.length
    ? combo.items.map((item) => newItemRow(item.name, item.quantityLabel ?? ''))
    : [newItemRow()],
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

/**
 * Every row needs a name; the quantity is optional. A row that is completely
 * blank is an error too (the message says to fill it in or remove it) rather
 * than being silently dropped, so what the admin sees is exactly what is saved.
 * Returns the items to send, or null when anything is wrong.
 */
function checkItems(rows: ItemRow[], errors: ComboFieldErrors): ComboItem[] | null {
  if (rows.length === 0) {
    errors.items = 'Add at least one item to the combo';
    return null;
  }
  if (rows.length > MAX_COMBO_ITEMS) {
    errors.items = `A combo can list at most ${MAX_COMBO_ITEMS} items`;
    return null;
  }
  const rowErrors: Record<string, ItemRowErrors> = {};
  const items: ComboItem[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    const quantity = row.quantityLabel.trim();
    const problem: ItemRowErrors = {};
    if (name === '') {
      problem.name = 'Enter the item name, or remove this row';
    } else if (name.length > ITEM_NAME_MAX) {
      problem.name = `Item name cannot exceed ${ITEM_NAME_MAX} characters`;
    }
    if (quantity.length > ITEM_QUANTITY_MAX) {
      problem.quantityLabel = `Quantity cannot exceed ${ITEM_QUANTITY_MAX} characters`;
    }
    if (problem.name || problem.quantityLabel) rowErrors[row.key] = problem;
    items.push({ name, quantityLabel: quantity === '' ? null : quantity });
  }
  if (Object.keys(rowErrors).length > 0) {
    errors.itemRows = rowErrors;
    return null;
  }
  return items;
}

/** Same items in the same order? (Name and label compared exactly; order matters.) */
const sameItems = (a: ComboItem[], b: ComboItem[]): boolean =>
  a.length === b.length &&
  a.every((item, i) => item.name === b[i].name && (item.quantityLabel ?? null) === (b[i].quantityLabel ?? null));

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
  const items = checkItems(values.items, errors);
  const quantity = checkQuantity(values.totalQuantity, 1);
  if (quantity.error) errors.totalQuantity = quantity.error;
  if (Object.keys(errors).length || items === null || price === null || quantity.value === null) {
    return { ok: false, errors };
  }

  const payload: CreateComboPayload = { name, items, price, totalQuantity: quantity.value };
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
  const items = checkItems(values.items, errors);
  const quantity = checkQuantity(values.totalQuantity, 0);
  if (quantity.error) errors.totalQuantity = quantity.error;
  if (Object.keys(errors).length || items === null || price === null || quantity.value === null) {
    return { ok: false, errors };
  }

  const payload: UpdateComboPayload = {};
  if (name !== original.name) payload.name = name;
  if (!frozen && slug !== original.slug) payload.slug = slug;
  if (values.description.trim() !== (original.description ?? '')) payload.description = values.description.trim();
  if (!sameItems(items, original.items ?? [])) payload.items = items; // the whole list replaces the old one
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
