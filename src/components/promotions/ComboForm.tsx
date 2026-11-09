'use client';

import { AlertCircle, Lock, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { NumericInput } from '@/components/shared/NumericInput';
import {
  ITEM_NAME_MAX,
  ITEM_QUANTITY_MAX,
  MAX_COMBO_ITEMS,
  MAX_DESCRIPTION_LENGTH,
  NAME_LENGTH,
  SLUG_LENGTH,
} from '@/lib/combos/constants';
import {
  addItemRow,
  removeItemRow,
  updateItemRow,
  type ComboFieldErrors,
  type ComboFormValues,
} from '@/lib/combos/form';

interface ComboFormProps {
  mode: 'create' | 'edit';
  values: ComboFormValues;
  errors: ComboFieldErrors;
  /** Published combos cannot change slug (the backend answers 409). */
  slugFrozen?: boolean;
  /** Edit only: units already committed to orders. Shown, never editable. */
  allocatedQuantity?: number;
  remainingQuantity?: number;
  disabled?: boolean;
  onChange: (patch: Partial<ComboFormValues>) => void;
}

const inputClass = (error?: string) =>
  `block min-h-11 w-full scroll-my-28 rounded-lg border bg-white px-3 py-2 text-base text-gray-900 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500 ${
    error
      ? 'border-2 border-red-600 focus:ring-2 focus:ring-red-200'
      : 'border-gray-300 focus:border-[#1a7a4a] focus:ring-2 focus:ring-[#1a7a4a]/20'
  }`;

const labelClass = 'mb-1 block text-sm font-semibold text-gray-800';
const hintClass = 'mt-1 text-sm text-gray-600';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  ) : null;
}

const ids = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ') || undefined;

/** One bordered group of the form, with its own heading. */
function Section({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <h2 id={id} className="mb-4 text-lg font-semibold text-[#0f4f2d]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * After a failed save attempt: focus the first invalid field, in page order. Presentation only;
 * it reads the errors the existing validation already produced.
 */
export function focusFirstInvalid(errors: ComboFieldErrors, values: ComboFormValues): void {
  const order: string[] = [];
  if (errors.name) order.push('combo-name');
  if (errors.slug) order.push('combo-slug');
  if (errors.description) order.push('combo-description');
  if (errors.items && values.items[0]) order.push(`${values.items[0].key}-name`);
  for (const row of values.items) {
    const e = errors.itemRows?.[row.key];
    if (e?.name) order.push(`${row.key}-name`);
    if (e?.quantityLabel) order.push(`${row.key}-quantity`);
  }
  if (errors.price) order.push('combo-price');
  if (errors.referencePrice) order.push('combo-reference-price');
  if (errors.totalQuantity) order.push('combo-total');
  const first = order[0];
  if (first) window.setTimeout(() => document.getElementById(first)?.focus(), 0);
}

export function hasFieldErrors(errors: ComboFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** A short summary shown above the actions when a save attempt found problems. */
export function ValidationSummary({ errors }: { errors: ComboFieldErrors }) {
  if (!hasFieldErrors(errors)) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-base font-medium text-red-700">
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      Please fix the highlighted fields.
    </p>
  );
}

/**
 * The Create / Save row. Below 768px it stays pinned to the bottom of the screen (clear of the
 * home indicator) while the form is in view; it is part of the page flow, so it never covers
 * content and it stops where the form ends, above the footer area.
 */
export function FormActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 border-t border-gray-200 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 max-md:sticky max-md:bottom-0 max-md:z-10 md:mx-0 md:border-0 md:bg-transparent md:p-0">
      {children}
    </div>
  );
}

export default function ComboForm({
  mode,
  values,
  errors,
  slugFrozen = false,
  allocatedQuantity,
  remainingQuantity,
  disabled = false,
  onChange,
}: ComboFormProps) {
  return (
    <>
      <Section id="section-basics" title="Basics">
        <div className="space-y-5">
          <div>
            <label htmlFor="combo-name" className={labelClass}>
              Name <span className="text-red-700">*</span>
            </label>
            <input
              id="combo-name"
              type="text"
              value={values.name}
              maxLength={NAME_LENGTH.max}
              disabled={disabled}
              required
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'combo-name-error' : undefined}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Festive Rice Combo"
              className={inputClass(errors.name)}
            />
            <FieldError id="combo-name-error" message={errors.name} />
          </div>

          <div>
            <label htmlFor="combo-slug" className={labelClass}>
              Slug {mode === 'create' && <span className="font-normal text-gray-600">(optional)</span>}
            </label>
            <div className="relative">
              <input
                id="combo-slug"
                type="text"
                value={values.slug}
                maxLength={SLUG_LENGTH.max}
                disabled={disabled}
                readOnly={slugFrozen}
                aria-invalid={!!errors.slug}
                aria-describedby={ids('combo-slug-help', !!errors.slug && 'combo-slug-error')}
                onChange={(e) => onChange({ slug: e.target.value })}
                placeholder="festive-rice-combo"
                className={`${inputClass(errors.slug)} ${slugFrozen ? 'bg-gray-50 pr-10 text-gray-600' : ''}`}
              />
              {slugFrozen && (
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              )}
            </div>
            <p id="combo-slug-help" className={hintClass}>
              {slugFrozen
                ? 'Locked while published, so the combo’s web address cannot change under customers. Unpublish it first to change the slug.'
                : mode === 'create'
                  ? 'Used in the combo’s web address. Leave blank to generate one from the name.'
                  : 'Lowercase letters and numbers separated by single hyphens. It becomes fixed once the combo is published.'}
            </p>
            <FieldError id="combo-slug-error" message={errors.slug} />
          </div>

          <div>
            <label htmlFor="combo-description" className={labelClass}>
              Description <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <textarea
              id="combo-description"
              value={values.description}
              rows={4}
              disabled={disabled}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'combo-description-error' : undefined}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="What is in the combo and why customers will want it"
              className={inputClass(errors.description)}
            />
            <div className="flex justify-between gap-3">
              <FieldError id="combo-description-error" message={errors.description} />
              <p
                className={`ml-auto mt-1 text-sm ${
                  values.description.length > MAX_DESCRIPTION_LENGTH ? 'font-medium text-red-700' : 'text-gray-600'
                }`}
              >
                {values.description.length.toLocaleString('en-NG')} / {MAX_DESCRIPTION_LENGTH.toLocaleString('en-NG')}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="section-included" title={<>What&apos;s included <span className="text-red-700">*</span></>}>
        <fieldset aria-describedby={ids('combo-items-help', !!errors.items && 'combo-items-error')}>
          <legend className="sr-only">What&apos;s included in this combo?</legend>
          <p id="combo-items-help" className="mb-3 text-sm text-gray-600">
            List each item customers will receive, one per row. The quantity or size is optional (for example
            &ldquo;1 kg&rdquo;, &ldquo;2 litres&rdquo; or &ldquo;1 derica&rdquo;). Customers see this list before they
            buy.
          </p>

          <ul className="space-y-3" aria-label="Combo contents">
            {values.items.map((row, index) => {
              const rowErrors = errors.itemRows?.[row.key];
              const position = index + 1;
              return (
                <li
                  key={row.key}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] sm:items-start sm:rounded-none sm:border-0 sm:p-0"
                >
                  <div>
                    <label htmlFor={`${row.key}-name`} className="mb-1 block text-sm font-semibold text-gray-800 sm:sr-only">
                      Item {position} name
                    </label>
                    <input
                      id={`${row.key}-name`}
                      type="text"
                      value={row.name}
                      maxLength={ITEM_NAME_MAX}
                      disabled={disabled}
                      aria-required="true"
                      aria-invalid={!!rowErrors?.name}
                      aria-describedby={rowErrors?.name ? `${row.key}-name-error` : undefined}
                      onChange={(e) => onChange({ items: updateItemRow(values.items, row.key, { name: e.target.value }) })}
                      placeholder="Item name, e.g. Rice"
                      className={inputClass(rowErrors?.name)}
                    />
                    <FieldError id={`${row.key}-name-error`} message={rowErrors?.name} />
                  </div>
                  <div>
                    <label
                      htmlFor={`${row.key}-quantity`}
                      className="mb-1 block text-sm font-semibold text-gray-800 sm:sr-only"
                    >
                      Item {position} quantity or size (optional)
                    </label>
                    <input
                      id={`${row.key}-quantity`}
                      type="text"
                      value={row.quantityLabel}
                      maxLength={ITEM_QUANTITY_MAX}
                      disabled={disabled}
                      aria-invalid={!!rowErrors?.quantityLabel}
                      aria-describedby={rowErrors?.quantityLabel ? `${row.key}-quantity-error` : undefined}
                      onChange={(e) =>
                        onChange({ items: updateItemRow(values.items, row.key, { quantityLabel: e.target.value }) })
                      }
                      placeholder="Quantity / size (optional)"
                      className={inputClass(rowErrors?.quantityLabel)}
                    />
                    <FieldError id={`${row.key}-quantity-error`} message={rowErrors?.quantityLabel} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({ items: removeItemRow(values.items, row.key) })}
                    disabled={disabled || values.items.length <= 1}
                    aria-label={`Remove item ${position}`}
                    title={values.items.length <= 1 ? 'A combo needs at least one item' : 'Remove this item'}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:bg-white disabled:hover:text-gray-700 sm:w-auto"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span className="sm:sr-only">Remove</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <FieldError id="combo-items-error" message={errors.items} />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={() => onChange({ items: addItemRow(values.items) })}
              disabled={disabled || values.items.length >= MAX_COMBO_ITEMS}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#b9e0c9] bg-white px-4 text-sm font-semibold text-[#1a7a4a] transition-colors hover:bg-[#e8f5ee] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Plus size={16} aria-hidden="true" />
              Add another item
            </button>
            <span className="text-center text-sm text-gray-600 sm:text-left">
              {values.items.length} / {MAX_COMBO_ITEMS} items
            </span>
          </div>
        </fieldset>
      </Section>

      <Section id="section-price" title="Price and stock">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="combo-price" className={labelClass}>
              Promotional price (₦) <span className="text-red-700">*</span>
            </label>
            <NumericInput
              id="combo-price"
              value={values.price}
              onChange={(v) => onChange({ price: v })}
              disabled={disabled}
              aria-required="true"
              aria-invalid={!!errors.price}
              aria-describedby={errors.price ? 'combo-price-error' : undefined}
              placeholder="0.00"
              className={inputClass(errors.price)}
            />
            <FieldError id="combo-price-error" message={errors.price} />
          </div>
          <div>
            <label htmlFor="combo-reference-price" className={labelClass}>
              Reference price (₦) <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <NumericInput
              id="combo-reference-price"
              value={values.referencePrice}
              onChange={(v) => onChange({ referencePrice: v })}
              disabled={disabled}
              aria-invalid={!!errors.referencePrice}
              aria-describedby={ids('combo-reference-price-help', !!errors.referencePrice && 'combo-reference-price-error')}
              placeholder="Original price"
              className={inputClass(errors.referencePrice)}
            />
            <p id="combo-reference-price-help" className={hintClass}>
              Shown struck through. Must not be below the promotional price.
            </p>
            <FieldError id="combo-reference-price-error" message={errors.referencePrice} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="combo-total" className={labelClass}>
              Total available quantity <span className="text-red-700">*</span>
            </label>
            <input
              id="combo-total"
              type="text"
              inputMode="numeric"
              value={values.totalQuantity}
              onChange={(e) => onChange({ totalQuantity: e.target.value.replace(/[^\d]/g, '') })}
              disabled={disabled}
              aria-required="true"
              aria-invalid={!!errors.totalQuantity}
              aria-describedby={ids('combo-total-help', !!errors.totalQuantity && 'combo-total-error')}
              placeholder="e.g. 50"
              className={`${inputClass(errors.totalQuantity)} sm:max-w-[14rem]`}
            />
            {mode === 'edit' && allocatedQuantity !== undefined && remainingQuantity !== undefined ? (
              <p id="combo-total-help" className={hintClass}>
                {allocatedQuantity.toLocaleString('en-NG')} allocated to orders,{' '}
                {remainingQuantity.toLocaleString('en-NG')} remaining. The total cannot go below the allocated units;
                changing it moves the remaining stock by the same amount.
              </p>
            ) : (
              <p id="combo-total-help" className={hintClass}>
                Every unit starts out available to customers.
              </p>
            )}
            <FieldError id="combo-total-error" message={errors.totalQuantity} />
          </div>
        </div>
      </Section>
    </>
  );
}
