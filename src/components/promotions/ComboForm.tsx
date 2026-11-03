'use client';

import { Lock } from 'lucide-react';
import { NumericInput } from '@/components/shared/NumericInput';
import {
  MAX_DESCRIPTION_LENGTH,
  NAME_LENGTH,
  SLUG_LENGTH,
} from '@/lib/combos/constants';
import type { ComboFieldErrors, ComboFormValues } from '@/lib/combos/form';

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
