'use client';

import type { AddressErrors, AddressInput } from '@/lib/storefront/addresses';
import { Field } from './ui';

/**
 * The fields of one delivery address. Each address has its own recipient name
 * and phone, so it can be for a friend or a family member. Free text: we
 * deliver anywhere.
 */
export default function AddressForm({
  value,
  onChange,
  errors,
  idPrefix,
}: {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: AddressErrors;
  idPrefix: string;
}) {
  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
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
