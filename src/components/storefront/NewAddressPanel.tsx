'use client';

import type { AddressErrors, AddressInput } from '@/lib/storefront/addresses';
import AddressForm from './AddressForm';
import { checkoutFocus } from './CheckoutSection';

const primary = `inline-flex min-h-12 items-center justify-center rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] ${checkoutFocus}`;
const secondary = `inline-flex min-h-12 items-center justify-center rounded-full border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] ${checkoutFocus}`;

/**
 * The "new delivery address" form with its buttons. It is shown in the form
 * column under "Where to" on tablets and laptops and inside a modal on phones;
 * the content is the same.
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
  const hasErrors = Object.keys(errors).length > 0;
  return (
    <div className="space-y-5">
      <div>
        <h2 id="new-address-title" className="scroll-mt-28 text-lg font-semibold text-[#0f4f2d]">
          New delivery address
        </h2>
        <p className="mt-1 text-base text-[#3b3a33]">Ordering for someone else? Use their name and phone number.</p>
      </div>
      <AddressForm value={value} onChange={onChange} errors={errors} idPrefix="checkout-address" large />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-[#1d2a22]">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#0f4f2d]" checked={saveToBook} onChange={(e) => onSaveToBook(e.target.checked)} />
        Save to my address book
      </label>
      {hasErrors && (
        <p role="alert" className="text-base font-medium text-[#8a2a1d]">
          Please fix the highlighted fields.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} onClick={onUse}>
          Use this address
        </button>
        <button type="button" className={secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
