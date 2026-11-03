'use client';

import { Lock, Plus, Trash2 } from 'lucide-react';
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
  `w-full px-3.5 py-2.5 text-sm border rounded-lg outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200'
      : 'border-gray-200 focus:border-[#1a7a4a] focus:ring-1 focus:ring-[#1a7a4a]/20'
  }`;

const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-xs text-red-500 mt-1">
      {message}
    </p>
  ) : null;
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
    <div className="space-y-5">
      <div>
        <label htmlFor="combo-name" className={labelClass}>
          Name <span className="text-red-500">*</span>
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
          Slug{' '}
          {mode === 'create' && <span className="text-gray-400 font-normal">(optional)</span>}
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
            aria-describedby="combo-slug-help"
            onChange={(e) => onChange({ slug: e.target.value })}
            placeholder="festive-rice-combo"
            className={`${inputClass(errors.slug)} ${slugFrozen ? 'bg-gray-50 text-gray-500 pr-9' : ''}`}
          />
          {slugFrozen && (
            <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          )}
        </div>
        <p id="combo-slug-help" className="text-xs text-gray-400 mt-1">
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
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="combo-description"
          value={values.description}
          rows={4}
          disabled={disabled}
          aria-invalid={!!errors.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What is in the combo and why customers will want it"
          className={inputClass(errors.description)}
        />
        <div className="flex justify-between">
          <FieldError id="combo-description-error" message={errors.description} />
          <p
            className={`text-xs ml-auto mt-1 ${
              values.description.length > MAX_DESCRIPTION_LENGTH ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {values.description.length.toLocaleString('en-NG')} / {MAX_DESCRIPTION_LENGTH.toLocaleString('en-NG')}
          </p>
        </div>
      </div>

      <fieldset
        className="space-y-3"
        aria-describedby={errors.items ? 'combo-items-help combo-items-error' : 'combo-items-help'}
      >
        <legend className={`${labelClass} mb-0`}>
          What&apos;s included in this combo? <span className="text-red-500">*</span>
        </legend>
        <p id="combo-items-help" className="text-xs text-gray-400 -mt-1">
          List each item customers will receive, one per row. The quantity or size is optional (for example &ldquo;1
          kg&rdquo;, &ldquo;2 litres&rdquo; or &ldquo;1 derica&rdquo;). Customers see this list before they buy.
        </p>

        <ul className="space-y-3" aria-label="Combo contents">
          {values.items.map((row, index) => {
            const rowErrors = errors.itemRows?.[row.key];
            const position = index + 1;
            return (
              <li
                key={row.key}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] gap-2 sm:gap-3 sm:items-start rounded-lg border border-gray-100 bg-gray-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div>
                  <label htmlFor={`${row.key}-name`} className="block text-xs font-medium text-gray-600 mb-1 sm:sr-only">
                    Item {position} name
                  </label>
                  <input
                    id={`${row.key}-name`}
                    type="text"
                    value={row.name}
                    maxLength={ITEM_NAME_MAX}
                    disabled={disabled}
                    aria-required="true"
                    aria-label={`Item ${position} name`}
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
                    className="block text-xs font-medium text-gray-600 mb-1 sm:sr-only"
                  >
                    Item {position} quantity or size (optional)
                  </label>
                  <input
                    id={`${row.key}-quantity`}
                    type="text"
                    value={row.quantityLabel}
                    maxLength={ITEM_QUANTITY_MAX}
                    disabled={disabled}
                    aria-label={`Item ${position} quantity or size (optional)`}
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
                  className="inline-flex items-center justify-center gap-1.5 h-[42px] px-3 text-sm text-gray-500 border border-gray-200 bg-white rounded-lg hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-500 disabled:hover:border-gray-200 disabled:hover:bg-white transition-colors"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sm:sr-only">Remove</span>
                </button>
              </li>
            );
          })}
        </ul>

        <FieldError id="combo-items-error" message={errors.items} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ items: addItemRow(values.items) })}
            disabled={disabled || values.items.length >= MAX_COMBO_ITEMS}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-[#1a7a4a] border border-[#b9e0c9] rounded-lg hover:bg-[#e8f5ee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={15} aria-hidden="true" />
            Add another item
          </button>
          <span className="text-xs text-gray-400">
            {values.items.length} / {MAX_COMBO_ITEMS} items
          </span>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="combo-price" className={labelClass}>
            Promotional price (₦) <span className="text-red-500">*</span>
          </label>
          <NumericInput
            id="combo-price"
            value={values.price}
            onChange={(v) => onChange({ price: v })}
            disabled={disabled}
            aria-required="true"
            aria-invalid={!!errors.price}
            placeholder="0.00"
            className={inputClass(errors.price)}
          />
          <FieldError id="combo-price-error" message={errors.price} />
        </div>
        <div>
          <label htmlFor="combo-reference-price" className={labelClass}>
            Reference price (₦) <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <NumericInput
            id="combo-reference-price"
            value={values.referencePrice}
            onChange={(v) => onChange({ referencePrice: v })}
            disabled={disabled}
            aria-invalid={!!errors.referencePrice}
            placeholder="Original price"
            className={inputClass(errors.referencePrice)}
          />
          <p className="text-xs text-gray-400 mt-1">Shown struck through. Must not be below the promotional price.</p>
          <FieldError id="combo-reference-price-error" message={errors.referencePrice} />
        </div>
      </div>

      <div>
        <label htmlFor="combo-total" className={labelClass}>
          Total available quantity <span className="text-red-500">*</span>
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
          placeholder="e.g. 50"
          className={`${inputClass(errors.totalQuantity)} sm:max-w-[14rem]`}
        />
        {mode === 'edit' && allocatedQuantity !== undefined && remainingQuantity !== undefined ? (
          <p className="text-xs text-gray-500 mt-1">
            {allocatedQuantity.toLocaleString('en-NG')} allocated to orders, {remainingQuantity.toLocaleString('en-NG')}{' '}
            remaining. The total cannot go below the allocated units; changing it moves the remaining stock by the same
            amount.
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">Every unit starts out available to customers.</p>
        )}
        <FieldError id="combo-total-error" message={errors.totalQuantity} />
      </div>
    </div>
  );
}
