'use client';

import type { AddressErrors, AddressInput } from '@/lib/storefront/addresses';
import { Field } from './ui';

/** The form's fields in on-screen order, so a failed submit can focus the first invalid one. */
export const ADDRESS_FIELD_ORDER: Array<keyof AddressInput> = ['recipientName', 'recipientPhone', 'addressLine', 'city', 'state', 'label'];

/** One checkout address field: 16px text, 48px tall, "required"/"optional" in the label, red border when invalid. */
function LargeField({
  id,
  label,
  optional,
  hint,
  error,
  ...input
}: { id: string; label: string; optional?: boolean; hint?: string; error?: string | null } & React.ComponentProps<'input'>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-base font-semibold text-[#1d2a22]">
        {label} <span className="font-normal text-[#5d5645]">({optional ? 'optional' : 'required'})</span>
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-required={optional ? undefined : true}
        aria-describedby={describedBy}
        className={`mt-1.5 block min-h-12 w-full scroll-mt-28 rounded-xl border bg-white px-4 py-3 text-base text-[#1d2a22] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] ${
          error ? 'border-2 border-[#8a2a1d]' : 'border-[#d9ccaf]'
        }`}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-[#5d5645]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-[#8a2a1d]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The fields of one delivery address. Each address has its own recipient name
 * and phone, so it can be for a friend or a family member. Free text: we
 * deliver anywhere. `large` is the checkout presentation (bigger fields,
 * autofill hints); the address book keeps the default.
 */
export default function AddressForm({
  value,
  onChange,
  errors,
  idPrefix,
  large = false,
  noRecipientAutofill = false,
}: {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: AddressErrors;
  idPrefix: string;
  large?: boolean;
  /** Large variant only: stops the browser filling the recipient's name and phone with the account holder's own (checkout leaves it off). */
  noRecipientAutofill?: boolean;
}) {
  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  if (large) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <LargeField id={`${idPrefix}-name`} label="Recipient's name" autoComplete={noRecipientAutofill ? 'off' : 'name'} value={value.recipientName} onChange={set('recipientName')} error={errors.recipientName} />
        <LargeField id={`${idPrefix}-phone`} label="Recipient's phone" type="tel" inputMode="tel" autoComplete={noRecipientAutofill ? 'off' : 'tel'} value={value.recipientPhone} onChange={set('recipientPhone')} error={errors.recipientPhone} hint="Who we call on delivery." />
        <div className="sm:col-span-2">
          <LargeField id={`${idPrefix}-line`} label="Street address" autoComplete="address-line1" value={value.addressLine} onChange={set('addressLine')} error={errors.addressLine} />
        </div>
        <LargeField id={`${idPrefix}-city`} label="City or town" autoComplete="address-level2" value={value.city} onChange={set('city')} error={errors.city} />
        <LargeField id={`${idPrefix}-state`} label="State" autoComplete="address-level1" value={value.state} onChange={set('state')} error={errors.state} />
        <div className="sm:col-span-2">
          <LargeField id={`${idPrefix}-label`} label="Save as" optional autoComplete="off" value={value.label} onChange={set('label')} error={errors.label} hint='For example "Home" or "Mum".' />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${idPrefix}-name`} label="Recipient's name" autoComplete="off" value={value.recipientName} onChange={set('recipientName')} error={errors.recipientName} />
      <Field id={`${idPrefix}-phone`} label="Recipient's phone" type="tel" autoComplete="off" value={value.recipientPhone} onChange={set('recipientPhone')} error={errors.recipientPhone} hint="Who we call on delivery." />
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-line`} label="Street address" autoComplete="off" value={value.addressLine} onChange={set('addressLine')} error={errors.addressLine} />
      </div>
      <Field id={`${idPrefix}-city`} label="City or town" autoComplete="off" value={value.city} onChange={set('city')} error={errors.city} />
      <Field id={`${idPrefix}-state`} label="State" autoComplete="off" value={value.state} onChange={set('state')} error={errors.state} />
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-label`} label="Save as (optional)" autoComplete="off" value={value.label} onChange={set('label')} error={errors.label} hint='For example "Home" or "Mum".' />
      </div>
    </div>
  );
}
