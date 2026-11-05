'use client';

import type { AddressErrors, AddressInput } from '@/lib/storefront/addresses';
import AddressForm from './AddressForm';
import { btnPrimary, btnSecondary } from './ui';

/**
 * The "new delivery address" form with its buttons. It is shown in a card beside
 * the total on laptops and inside a modal on phones; the content is the same.
 */
export default function NewAddressPanel({
  value,
  onChange,
  errors,
  saveToBook,
  onSaveToBook,
  onUse,
  onCancel,
}: {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: AddressErrors;
  saveToBook: boolean;
  onSaveToBook: (next: boolean) => void;
  onUse: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 id="new-address-title" className="text-lg font-bold text-[#0f4f2d]">New delivery address</h2>
        <p className="mt-1 text-sm text-[#5d5645]">Ordering for someone else? Use their name and phone number.</p>
      </div>
      <AddressForm value={value} onChange={onChange} errors={errors} idPrefix="checkout-address" />
      <label className="flex items-start gap-2 text-sm text-[#3b3a33]">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0f4f2d]" checked={saveToBook} onChange={(e) => onSaveToBook(e.target.checked)} />
        Save to my address book
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btnPrimary} onClick={onUse}>Use this address</button>
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
