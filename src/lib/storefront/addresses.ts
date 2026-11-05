/**
 * The customer's address book and the delivery/pickup choice, parsed field by
 * field from the API (enechambs-api `src/customer-addresses`, `src/orders`).
 * Unknown fields are dropped. The checks here only save a round trip: the API
 * repeats every rule. Relative imports only (node:test loads this).
 */
import { nameError, phoneError } from './auth-forms.ts';

export interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  /** Required when saving; older data may lack it. */
  state: string | null;
  isDefault: boolean;
}

/** What the form holds (plain strings; empty means "not given"). */
export interface AddressInput {
  label: string;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  city: string;
  state: string;
}

export interface CheckoutOptions {
  deliveryFee: number;
  pickup: { address: string; hours: string };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function parseAddress(v: unknown): Address | null {
  if (!isObject(v)) return null;
  const id = str(v.id);
  const recipientName = str(v.recipientName);
  const recipientPhone = str(v.recipientPhone);
  const addressLine = str(v.addressLine);
  const city = str(v.city);
  if (!id || !recipientName || !recipientPhone || !addressLine || !city) return null;
  return { id, label: str(v.label), recipientName, recipientPhone, addressLine, city, state: str(v.state), isDefault: v.isDefault === true };
}

export function parseAddressList(v: unknown): Address[] | null {
  if (!Array.isArray(v)) return null;
  const list = v.map(parseAddress);
  return list.some((a) => a === null) ? null : (list as Address[]);
}

export function parseCheckoutOptions(v: unknown): CheckoutOptions | null {
  if (!isObject(v) || typeof v.deliveryFee !== 'number' || !isObject(v.pickup)) return null;
  const address = str(v.pickup.address);
  const hours = str(v.pickup.hours);
  return address && hours ? { deliveryFee: v.deliveryFee, pickup: { address, hours } } : null;
}

export const emptyAddressInput = (): AddressInput => ({ label: '', recipientName: '', recipientPhone: '', addressLine: '', city: '', state: '' });

export const addressToInput = (a: Address): AddressInput => ({
  label: a.label ?? '',
  recipientName: a.recipientName,
  recipientPhone: a.recipientPhone,
  addressLine: a.addressLine,
  city: a.city,
  state: a.state ?? '',
});

export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

export function addressErrors(input: AddressInput): AddressErrors {
  const errors: AddressErrors = {};
  if (nameError(input.recipientName)) errors.recipientName = "Enter the recipient's name.";
  if (phoneError(input.recipientPhone)) errors.recipientPhone = "Enter the recipient's Nigerian phone number, e.g. 08031234567.";
  const line = input.addressLine.trim();
  if (line.length < 5) errors.addressLine = 'Enter the street address.';
  else if (line.length > 200) errors.addressLine = 'That address is too long.';
  const city = input.city.trim();
  if (city.length < 2) errors.city = 'Enter the city or town.';
  else if (city.length > 100) errors.city = 'That is too long.';
  if (input.label.trim().length > 40) errors.label = 'Use 40 characters or fewer.';
  const state = input.state.trim();
  if (state.length < 2) errors.state = 'Enter the state.';
  else if (state.length > 100) errors.state = 'That is too long.';
  return errors;
}

/** The request body for one address: trimmed, and optional fields left out when blank. */
export function toRequestAddress(input: AddressInput) {
  const optional = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    recipientName: input.recipientName.trim(),
    recipientPhone: input.recipientPhone.trim(),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    ...(optional(input.label) ? { label: optional(input.label) } : {}),
  };
}

/** The body for editing an address: every field is sent, and a blank label clears it. */
export const toUpdateAddress = (input: AddressInput) => ({
  recipientName: input.recipientName.trim(),
  recipientPhone: input.recipientPhone.trim(),
  addressLine: input.addressLine.trim(),
  city: input.city.trim(),
  state: input.state.trim(),
  label: input.label.trim(),
});

/** "12 Admiralty Way, Lagos, Lagos State" */
export const formatAddressLine = (a: Pick<Address, 'addressLine' | 'city' | 'state'>): string =>
  [a.addressLine, a.city, a.state].filter((part): part is string => !!part && part.trim().length > 0).join(', ');

/** What the order request says about fulfilment. */
export type FulfilmentChoice =
  | { method: 'pickup' }
  | { method: 'delivery'; addressId: string }
  | { method: 'delivery'; address: ReturnType<typeof toRequestAddress>; saveAddress: boolean };

