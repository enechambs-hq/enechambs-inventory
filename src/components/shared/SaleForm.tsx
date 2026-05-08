'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import InventorySearchSelect from './InventorySearchSelect';
import { BulkSaleDto, CreateSaleDto, InventoryItem, SaleSubmitPayload, Vendor } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { dashboardService } from '@/lib/services/dashboard.service';
import { format } from 'date-fns';

type CartRow = {
  id: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

const newRow = (): CartRow => ({
  id: crypto.randomUUID(),
  inventoryId: '',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
});

const customerSchema = z.object({
  date: z.string().min(1, 'Required'),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().regex(/^\d{11}$/, 'Phone must be exactly 11 digits'),
  customerEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().email('Invalid email').optional()
  ),
  customerId: z.string().optional(),
  accountPaidTo: z.string().min(1, 'Required'),
});

type CustomerFormInput = z.input<typeof customerSchema>;
type CustomerFormOutput = z.output<typeof customerSchema>;

interface Props {
  onSubmit: (payload: SaleSubmitPayload) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function SaleForm({ onSubmit, isLoading, onCancel }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [cart, setCart] = useState<CartRow[]>([newRow()]);
  const [cartError, setCartError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Vendor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inventoryService
      .getAvailableForSale()
      .then((items) => setInventory(items ?? []))
      .catch(() => setInventory([]))
      .finally(() => setLoadingInventory(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { field: phoneField } = useController({ control: control as any, name: 'customerPhone', defaultValue: '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { field: nameField } = useController({ control: control as any, name: 'customerName', defaultValue: '' });
  const phoneLength = phoneField.value?.length ?? 0;

  const handleNameChange = (val: string) => {
    const capitalized = val.replace(/\b\w/g, (c) => c.toUpperCase());
    nameField.onChange(capitalized);
    setValue('customerId', undefined);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (capitalized.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await dashboardService.searchCustomers(capitalized);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch { setSuggestions([]); }
    }, 100);
  };

  const handleSelectCustomer = (c: Vendor) => {
    setValue('customerName', c.customerName, { shouldValidate: true });
    setValue('customerId', c.id);
    phoneField.onChange(c.customerPhone ?? '');
    setValue('customerEmail', c.customerEmail ?? '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const addRow = () => setCart((prev) => [newRow(), ...prev]);

  const removeRow = (id: string) => {
    if (cart.length === 1) return;
    setCart((prev) => prev.filter((r) => r.id !== id));
  };

  const onSelectInventory = (rowId: string, inventoryId: string) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (!item) return;
    setCart((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, inventoryId, unitPrice: item.sellingPrice, amount: item.sellingPrice * r.quantity }
          : r
      )
    );
  };

  const onChangeQty = (rowId: string, qty: number) => {
    const safeQty = Math.max(1, qty || 1);
    setCart((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, quantity: safeQty, amount: r.unitPrice * safeQty } : r
      )
    );
  };

  const onChangeAmount = (rowId: string, raw: string) => {
    const amount = Number(raw.replace(/,/g, '')) || 0;
    setCart((prev) => prev.map((r) => (r.id === rowId ? { ...r, amount } : r)));
  };

  const grandTotal = cart.reduce((s, r) => s + r.amount, 0);
  const filledRows = cart.filter((r) => r.inventoryId);

  const onFormSubmit = handleSubmit(async (customerData: CustomerFormOutput) => {
    if (filledRows.length === 0) {
      setCartError('Add at least one item');
      return;
    }
    setCartError(null);

    if (filledRows.length === 1) {
      const r = filledRows[0];
      await onSubmit({
        type: 'single',
        data: {
          inventoryId: r.inventoryId,
          date: customerData.date,
          quantity: r.quantity,
          amount: r.amount,
          customerName: customerData.customerName,
          customerPhone: customerData.customerPhone,
          customerEmail: customerData.customerEmail,
          customerId: customerData.customerId,
          accountPaidTo: customerData.accountPaidTo,
        } as CreateSaleDto,
      });
    } else {
      await onSubmit({
        type: 'bulk',
        data: {
          date: customerData.date,
          customerName: customerData.customerName,
          customerPhone: customerData.customerPhone,
          customerEmail: customerData.customerEmail,
          customerId: customerData.customerId,
          accountPaidTo: customerData.accountPaidTo,
          items: filledRows.map((r) => ({
            inventoryId: r.inventoryId,
            quantity: r.quantity,
            amount: r.amount,
          })),
        } as BulkSaleDto,
      });
    }
  });

  const inputCls = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">

      {/* ── Customer ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Customer
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name with autocomplete */}
          <div className="space-y-1 relative" ref={suggestionsRef}>
            <label className="text-sm font-medium">Customer Name</label>
            <input
              {...nameField}
              type="text"
              autoComplete="off"
              className={inputCls}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {showSuggestions && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => handleSelectCustomer(c)}
                    className="w-full px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                  >
                    <p className="text-sm font-medium">{c.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.customerPhone}{c.customerEmail ? ` · ${c.customerEmail}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {errors.customerName && (
              <p className="text-xs text-destructive">{errors.customerName.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Phone</label>
            <div className="relative">
              <input
                {...phoneField}
                type="text"
                inputMode="numeric"
                maxLength={11}
                className={`${inputCls} pr-14`}
                onKeyDown={(e) => {
                  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
                  if (phoneLength >= 11 && !allowed.includes(e.key)) e.preventDefault();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 11);
                  phoneField.onChange(pasted);
                }}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                phoneLength === 11 ? 'text-green-600' : 'text-muted-foreground/50'
              }`}>
                {phoneLength}/11
              </span>
            </div>
            {errors.customerPhone ? (
              <p className="text-xs text-destructive">{errors.customerPhone.message}</p>
            ) : phoneLength > 0 && phoneLength < 11 ? (
              <p className="text-xs text-amber-500">{11 - phoneLength} more digit{11 - phoneLength !== 1 ? 's' : ''} needed</p>
            ) : null}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Email <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input {...register('customerEmail')} type="email" className={inputCls} />
            {errors.customerEmail && (
              <p className="text-xs text-destructive">{errors.customerEmail.message}</p>
            )}
          </div>

          {/* Account Paid To */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Account Paid To</label>
            <input {...register('accountPaidTo')} type="text" className={inputCls} />
            {errors.accountPaidTo && (
              <p className="text-xs text-destructive">{errors.accountPaidTo.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <input {...register('date')} type="date" className={inputCls} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
        </div>
        <input type="hidden" {...register('customerId')} />
      </div>

      {/* ── Cart ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </p>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={13} /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {cart.map((row, idx) => {
            const item = inventory.find((i) => i.id === row.inventoryId);
            return (
              <div key={row.id} className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Item {idx + 1}
                  </span>
                  {cart.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <InventorySearchSelect
                  items={inventory}
                  value={row.inventoryId}
                  onChange={(id) => onSelectInventory(row.id, id)}
                  disabled={loadingInventory}
                  placeholder={loadingInventory ? 'Loading…' : 'Select product'}
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => onChangeQty(row.id, parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Amount (₦)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.amount === 0 ? '' : row.amount.toLocaleString()}
                      onChange={(e) => onChangeAmount(row.id, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {item && (
                  <p className="text-[11px] text-muted-foreground">
                    Unit price: ₦{item.sellingPrice.toLocaleString()} · {item.quantity} {item.unit} in stock
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {cartError && <p className="text-xs text-destructive mt-2">{cartError}</p>}

        {/* Grand total */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {filledRows.length} item{filledRows.length !== 1 ? 's' : ''} · Grand Total
          </span>
          <span className="text-lg font-extrabold text-primary tracking-tight">
            ₦{grandTotal.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving…' : 'Record Sale'}
        </button>
      </div>
    </form>
  );
}
