'use client';

import { MapPin } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  addressErrors,
  addressToInput,
  emptyAddressInput,
  formatAddressLine,
  toRequestAddress,
  toUpdateAddress,
  type Address,
  type AddressErrors,
  type AddressInput,
} from '@/lib/storefront/addresses';
import { storeRequest } from '@/lib/storefront/store-client';
import { appErrorFromStore } from '@/lib/errors/store-adapter';
import LoadErrorPanel from '@/components/errors/LoadErrorPanel';
import AddressForm, { ADDRESS_FIELD_ORDER } from './AddressForm';
import SignInPrompt from './SignInPrompt';
import { Notice, Spinner } from './ui';
import { useAddresses } from './useAddresses';
import { useSession } from './use-session';

const ok = () => true as const;
type Editing = { id: string | 'new' } | null;

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] disabled:cursor-not-allowed disabled:opacity-50';
const primary = `inline-flex min-h-12 items-center justify-center rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] ${focus}`;
const secondary = `inline-flex min-h-12 items-center justify-center rounded-full border border-[#d9ccaf] bg-white px-6 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] ${focus}`;
const danger = `inline-flex min-h-12 items-center justify-center rounded-full border border-[#e4b4ae] bg-white px-6 text-base font-bold text-[#8a2a1d] transition hover:bg-[#fdf1ef] ${focus}`;
const action = `inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9ccaf] bg-white px-4 text-base font-semibold text-[#0f4f2d] transition hover:bg-[#f6efe0] ${focus}`;
const actionDanger = `inline-flex min-h-11 items-center justify-center rounded-full border border-[#e4b4ae] bg-white px-4 text-base font-semibold text-[#8a2a1d] transition hover:bg-[#fdf1ef] ${focus}`;
const panel = 'rounded-2xl border border-[#eadfc8] bg-white p-5';

const FIELD_SUFFIX = { recipientName: 'name', recipientPhone: 'phone', addressLine: 'line', city: 'city', state: 'state', label: 'label' } as const;

/** The 640px reading column with the page heading; every state of the page sits inside it. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[40rem]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">Address book</h1>
        <p className="mt-1 text-base text-[#5d5645]">Save addresses for yourself, friends and family, and pick one at checkout.</p>
      </header>
      {children}
    </div>
  );
}

/**
 * The customer's saved delivery addresses. Each has its own recipient name and
 * phone, so it can be for a friend or a family member. Past orders keep their
 * own copy of the address they were placed with, so changes here never alter them.
 */
export default function AddressBookView() {
  const session = useSession();
  const book = useAddresses(session.status === 'signed_in');
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<AddressInput>(emptyAddressInput());
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  if (session.status === 'loading') return <Frame><Spinner label="Loading your address book" /></Frame>;
  if (session.status === 'signed_out') return <Frame><SignInPrompt next="/account/addresses" reason="Sign in to see your saved addresses." /></Frame>;
  if (session.status === 'unavailable') return <Frame><Notice tone="error">We could not check your sign-in right now. Please refresh the page in a moment.</Notice></Frame>;
  if (book.status === 'loading') return <Frame><Spinner label="Loading your addresses" /></Frame>;
  if (book.status === 'error') {
    return (
      <Frame>
        <LoadErrorPanel error={book.error} onRetry={book.reload} title="We could not load your addresses" />
      </Frame>
    );
  }

  const addresses = book.addresses;
  const startAdd = () => {
    setDraft(emptyAddressInput());
    setMakeDefault(false);
    setErrors({});
    setFailure(null);
    setEditing({ id: 'new' });
  };
  const startEdit = (a: Address) => {
    setDraft(addressToInput(a));
    setMakeDefault(false);
    setErrors({});
    setFailure(null);
    setEditing({ id: a.id });
  };
  const cancel = () => {
    setEditing(null);
    setErrors({});
    setFailure(null);
  };

  /** After a failed save attempt: focus the first invalid field. */
  function focusFirstInvalid(found: AddressErrors) {
    const first = ADDRESS_FIELD_ORDER.find((key) => found[key]);
    if (!first || !editing) return;
    const prefix = editing.id === 'new' ? 'new-address' : `edit-${editing.id}`;
    window.setTimeout(() => document.getElementById(`${prefix}-${FIELD_SUFFIX[first]}`)?.focus(), 0);
  }

  async function save() {
    if (!editing || busy) return;
    const found = addressErrors(draft);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) {
      focusFirstInvalid(found);
      return;
    }
    setBusy(true);
    const isNew = editing.id === 'new';
    const r = await storeRequest({
      path: isNew ? 'storefront/addresses' : `storefront/addresses/${editing.id}`,
      method: isNew ? 'POST' : 'PATCH',
      body: { ...(isNew ? toRequestAddress(draft) : toUpdateAddress(draft)), ...(makeDefault ? { isDefault: true } : {}) },
      parse: ok,
    });
    setBusy(false);
    if (!r.ok) return setFailure(appErrorFromStore(r, { method: isNew ? 'POST' : 'PATCH', action: 'change' }).message);
    setEditing(null);
    book.reload();
  }

  async function makeDefaultAddress(a: Address) {
    setBusy(true);
    setFailure(null);
    const r = await storeRequest({ path: `storefront/addresses/${a.id}`, method: 'PATCH', body: { isDefault: true }, parse: ok });
    setBusy(false);
    if (!r.ok) return setFailure(appErrorFromStore(r, { method: 'PATCH', action: 'change' }).message);
    book.reload();
  }

  async function remove(a: Address) {
    setBusy(true);
    setFailure(null);
    const r = await storeRequest({ path: `storefront/addresses/${a.id}`, method: 'DELETE', body: {}, parse: ok });
    setBusy(false);
    setConfirmingDelete(null);
    if (!r.ok) return setFailure(appErrorFromStore(r, { method: 'DELETE', action: 'change' }).message);
    book.reload();
  }

  const hasErrors = Object.keys(errors).length > 0;
  const defaultBox = (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-[#1d2a22]">
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#0f4f2d]" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
      Make this my default address
    </label>
  );
  const formButtons = (label: string) => (
    <>
      {hasErrors && (
        <p role="alert" className="text-base font-medium text-[#8a2a1d]">
          Please fix the highlighted fields.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} disabled={busy} onClick={save}>{busy ? 'Saving…' : label}</button>
        <button type="button" className={secondary} disabled={busy} onClick={cancel}>Cancel</button>
      </div>
    </>
  );
  const addButton = (
    <button type="button" className={primary} onClick={startAdd}>
      Add an address
    </button>
  );

  return (
    <Frame>
      <div className="flex flex-col gap-3 sm:gap-4">
        {failure && editing === null && <Notice tone="error">{failure}</Notice>}

        {addresses.length === 0 && editing === null && (
          <div className="flex flex-col items-center rounded-3xl border border-[#eadfc8] bg-white/70 px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6efe0] text-[#1a7a4a]">
              <MapPin size={26} aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-[#1d2a22]">You have no saved addresses yet.</h2>
            <div className="mt-5">{addButton}</div>
          </div>
        )}

        {addresses.map((a) =>
          editing?.id === a.id ? (
            <div key={a.id} className={panel}>
              <h2 className="text-lg font-semibold text-[#0f4f2d]">Edit address</h2>
              {failure && <div className="mt-3"><Notice tone="error">{failure}</Notice></div>}
              <div className="mt-4 space-y-5">
                <AddressForm value={draft} onChange={setDraft} errors={errors} idPrefix={`edit-${a.id}`} large noRecipientAutofill />
                {!a.isDefault && defaultBox}
                {formButtons('Save changes')}
              </div>
            </div>
          ) : (
            <div key={a.id} className={panel}>
              <div className="min-w-0 text-base text-[#3b3a33]">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-base font-semibold text-[#0f4f2d]">{a.recipientName}</span>
                  {a.isDefault && <span className="rounded-full bg-[#e5f4ea] px-2.5 py-0.5 text-sm font-semibold text-[#14693f]">Default</span>}
                  {a.label && <span className="rounded-full bg-[#f1e9d6] px-2.5 py-0.5 text-sm font-semibold text-[#5d5645]">{a.label}</span>}
                </p>
                <p className="mt-1 break-words">{formatAddressLine(a)}</p>
                <p className="break-words">{a.recipientPhone}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f1e9d6] pt-4">
                {!a.isDefault && (
                  <button type="button" className={action} disabled={busy} onClick={() => makeDefaultAddress(a)}>Make default</button>
                )}
                <button type="button" className={action} disabled={busy} onClick={() => startEdit(a)}>Edit</button>
                {confirmingDelete !== a.id && (
                  <button type="button" className={actionDanger} disabled={busy} onClick={() => setConfirmingDelete(a.id)}>Delete</button>
                )}
              </div>
              {confirmingDelete === a.id && (
                <div className="mt-4 rounded-xl border border-[#e4b4ae] bg-[#fdf1ef] p-4">
                  <p className="text-base font-semibold text-[#8a2a1d]">Delete this address?</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <button type="button" className={`${danger} w-full sm:w-auto`} disabled={busy} onClick={() => remove(a)}>Yes, delete</button>
                    <button type="button" className={`${secondary} w-full sm:w-auto`} onClick={() => setConfirmingDelete(null)}>Keep it</button>
                  </div>
                </div>
              )}
            </div>
          ),
        )}

        {editing?.id === 'new' ? (
          <div className={panel}>
            <h2 className="text-lg font-semibold text-[#0f4f2d]">Add an address</h2>
            {failure && <div className="mt-3"><Notice tone="error">{failure}</Notice></div>}
            <div className="mt-4 space-y-5">
              <AddressForm value={draft} onChange={setDraft} errors={errors} idPrefix="new-address" large noRecipientAutofill />
              {addresses.length > 0 && defaultBox}
              {formButtons('Save address')}
            </div>
          </div>
        ) : (
          editing === null && addresses.length > 0 && <div>{addButton}</div>
        )}
      </div>
    </Frame>
  );
}
