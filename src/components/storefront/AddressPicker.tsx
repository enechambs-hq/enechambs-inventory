'use client';

import { Plus } from 'lucide-react';
import { formatAddressLine, type Address, type AddressInput } from '@/lib/storefront/addresses';
import { btnPrimary, btnSecondary, Card, Notice, Spinner } from './ui';
import type { AddressesState } from './useAddresses';

/** An address typed in at checkout, not yet in the address book. */
export interface NewAddress {
  input: AddressInput;
  saveToBook: boolean;
}

/** The id the picker uses for the not-yet-saved address typed in at checkout. */
export const NEW_ADDRESS = 'new';

const card = (selected: boolean) =>
  `block w-full rounded-xl border p-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] ${
    selected ? 'border-[#0f4f2d] bg-[#e8f5ee] ring-1 ring-[#0f4f2d]' : 'border-[#d9ccaf] bg-white hover:bg-[#f6efe0]'
  }`;

/**
 * "Deliver to": the customer's saved addresses plus, if they typed one in, that
 * new address. Adding or editing an address opens a panel (beside the total on
 * laptops, a modal on phones); this card only lists and selects.
 */
export default function AddressPicker({
  addresses,
  selected,
  newAddress,
  onSelect,
  onAdd,
  onEditNew,
  onRetry,
  needAddress,
}: {
  addresses: AddressesState;
  selected: string | null;
  newAddress: NewAddress | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEditNew: () => void;
  onRetry: () => void;
  needAddress: boolean;
}) {
  if (addresses.status === 'loading') return <Card><Spinner label="Loading your addresses" /></Card>;
  if (addresses.status === 'error') {
    return (
      <Card>
        <Notice tone="error">{addresses.message}</Notice>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={onRetry}>Try again</button>
      </Card>
    );
  }
  const saved = addresses.addresses;
  const empty = saved.length === 0 && !newAddress;

  return (
    <Card>
      <h2 className="text-lg font-bold text-[#0f4f2d]">Deliver to</h2>
      {needAddress && <div className="mt-3"><Notice tone="warn">Add the address we should deliver to.</Notice></div>}
      {empty ? (
        <div className="mt-3">
          <p className="text-sm text-[#5d5645]">Where should we deliver? You can save it for next time.</p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            Add delivery address
          </button>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Delivery addresses" className="mt-3 space-y-2">
            {newAddress && (
              <div className={card(selected === NEW_ADDRESS)}>
                <button type="button" role="radio" aria-checked={selected === NEW_ADDRESS} onClick={() => onSelect(NEW_ADDRESS)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0f4f2d]">{newAddress.input.recipientName.trim()}</span>
                    <span className="rounded-full bg-[#fdf6dc] px-2 py-0.5 text-[11px] font-semibold text-[#7a5a0c]">New</span>
                    {newAddress.saveToBook && <span className="text-[11px] text-[#8b7f6b]">Will be saved</span>}
                  </span>
                  <span className="mt-1 block text-[#3b3a33]">{formatAddressLine({ addressLine: newAddress.input.addressLine.trim(), city: newAddress.input.city.trim(), state: newAddress.input.state.trim() || null })}</span>
                  <span className="block text-xs text-[#8b7f6b]">{newAddress.input.recipientPhone.trim()}</span>
                </button>
                <button type="button" className="mt-1 text-xs font-medium text-[#1a7a4a] underline-offset-4 hover:underline" onClick={onEditNew}>Edit</button>
              </div>
            )}
            {saved.map((a: Address) => (
              <button key={a.id} type="button" role="radio" aria-checked={selected === a.id} onClick={() => onSelect(a.id)} className={card(selected === a.id)}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#0f4f2d]">{a.recipientName}</span>
                  {a.label && <span className="rounded-full bg-[#f1e9d6] px-2 py-0.5 text-[11px] font-semibold text-[#5d5645]">{a.label}</span>}
                  {a.isDefault && <span className="rounded-full bg-[#e5f4ea] px-2 py-0.5 text-[11px] font-semibold text-[#14693f]">Default</span>}
                </span>
                <span className="mt-1 block text-[#3b3a33]">{formatAddressLine(a)}</span>
                <span className="block text-xs text-[#8b7f6b]">{a.recipientPhone}</span>
              </button>
            ))}
          </div>
          <button type="button" className={`${btnSecondary} mt-3`} onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            Add a new address
          </button>
        </>
      )}
      <p className="mt-4 text-xs text-[#8b7f6b]">If we cannot deliver to your area, we will contact you.</p>
    </Card>
  );
}
