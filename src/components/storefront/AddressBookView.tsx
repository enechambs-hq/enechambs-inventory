'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import AddressForm from './AddressForm';
import SignInPrompt from './SignInPrompt';
import { btnPrimary, btnSecondary, Card, linkClass, Notice, Spinner } from './ui';
import { useAddresses } from './useAddresses';
import { useSession } from './use-session';

const ok = () => true as const;
type Editing = { id: string | 'new' } | null;

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

  if (session.status === 'loading') return <Spinner label="Loading your address book" />;
  if (session.status === 'signed_out') return <SignInPrompt next="/account/addresses" reason="Sign in to see your saved addresses." />;
  if (session.status === 'unavailable') return <Notice tone="error">We could not check your sign-in right now. Please refresh the page in a moment.</Notice>;
  if (book.status === 'loading') return <Spinner label="Loading your addresses" />;
  if (book.status === 'error') {
    return (
      <div className="space-y-4">
        <Notice tone="error">{book.message}</Notice>
        <button type="button" className={btnSecondary} onClick={book.reload}>Try again</button>
      </div>
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

  async function save() {
    if (!editing || busy) return;
    const found = addressErrors(draft);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const isNew = editing.id === 'new';
    const r = await storeRequest({
      path: isNew ? 'storefront/addresses' : `storefront/addresses/${editing.id}`,
      method: isNew ? 'POST' : 'PATCH',
      body: { ...(isNew ? toRequestAddress(draft) : toUpdateAddress(draft)), ...(makeDefault ? { isDefault: true } : {}) },
      parse: ok,
    });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    setEditing(null);
    book.reload();
  }

  async function makeDefaultAddress(a: Address) {
    setBusy(true);
    setFailure(null);
    const r = await storeRequest({ path: `storefront/addresses/${a.id}`, method: 'PATCH', body: { isDefault: true }, parse: ok });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    book.reload();
  }

  async function remove(a: Address) {
    setBusy(true);
    setFailure(null);
    const r = await storeRequest({ path: `storefront/addresses/${a.id}`, method: 'DELETE', body: {}, parse: ok });
    setBusy(false);
    setConfirmingDelete(null);
    if (!r.ok) return setFailure(friendlyMessage(r));
    book.reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#5d5645]">Save addresses for yourself, friends and family, and pick one at checkout.</p>
      {failure && editing === null && <Notice tone="error">{failure}</Notice>}

      {addresses.length === 0 && editing === null && (
        <Card className="text-center">
          <p className="text-[#5d5645]">You have no saved addresses yet.</p>
        </Card>
      )}

      {addresses.map((a) =>
        editing?.id === a.id ? (
          <Card key={a.id}>
            <h2 className="text-lg font-bold text-[#0f4f2d]">Edit address</h2>
            {failure && <div className="mt-3"><Notice tone="error">{failure}</Notice></div>}
            <div className="mt-3 space-y-4">
              <AddressForm value={draft} onChange={setDraft} errors={errors} idPrefix={`edit-${a.id}`} />
              {!a.isDefault && (
                <label className="flex items-start gap-2 text-sm text-[#3b3a33]">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0f4f2d]" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
                  Make this my default address
                </label>
              )}
              <div className="flex gap-3">
                <button type="button" className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
                <button type="button" className={btnSecondary} disabled={busy} onClick={cancel}>Cancel</button>
              </div>
            </div>
          </Card>
        ) : (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm text-[#3b3a33]">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-[#0f4f2d]">{a.recipientName}</span>
                  {a.label && <span className="rounded-full bg-[#f1e9d6] px-2 py-0.5 text-[11px] font-semibold text-[#5d5645]">{a.label}</span>}
                  {a.isDefault && <span className="rounded-full bg-[#e5f4ea] px-2 py-0.5 text-[11px] font-semibold text-[#14693f]">Default</span>}
                </p>
                <p className="mt-1">{formatAddressLine(a)}</p>
                <p className="text-xs text-[#8b7f6b]">{a.recipientPhone}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {!a.isDefault && (
                  <button type="button" className={linkClass} disabled={busy} onClick={() => makeDefaultAddress(a)}>Make default</button>
                )}
                <button type="button" className={`${linkClass} inline-flex items-center gap-1`} disabled={busy} onClick={() => startEdit(a)}>
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
                {confirmingDelete === a.id ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[#5d5645]">Delete this address?</span>
                    <button type="button" className="font-semibold text-[#8a2a1d] underline-offset-4 hover:underline" disabled={busy} onClick={() => remove(a)}>Yes, delete</button>
                    <button type="button" className={linkClass} onClick={() => setConfirmingDelete(null)}>Keep it</button>
                  </span>
                ) : (
                  <button type="button" className="inline-flex items-center gap-1 font-medium text-[#8a2a1d] underline-offset-4 hover:underline" disabled={busy} onClick={() => setConfirmingDelete(a.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </Card>
        ),
      )}

      {editing?.id === 'new' ? (
        <Card>
          <h2 className="text-lg font-bold text-[#0f4f2d]">Add an address</h2>
          {failure && <div className="mt-3"><Notice tone="error">{failure}</Notice></div>}
          <div className="mt-3 space-y-4">
            <AddressForm value={draft} onChange={setDraft} errors={errors} idPrefix="new-address" />
            {addresses.length > 0 && (
              <label className="flex items-start gap-2 text-sm text-[#3b3a33]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0f4f2d]" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
                Make this my default address
              </label>
            )}
            <div className="flex gap-3">
              <button type="button" className={btnPrimary} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save address'}</button>
              <button type="button" className={btnSecondary} disabled={busy} onClick={cancel}>Cancel</button>
            </div>
          </div>
        </Card>
      ) : (
        editing === null && (
          <button type="button" className={btnPrimary} onClick={startAdd}>
            <Plus size={16} aria-hidden="true" />
            Add an address
          </button>
        )
      )}
    </div>
  );
}
