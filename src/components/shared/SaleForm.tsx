'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, useController } from 'react-hook-form';
import InventorySearchSelect from './InventorySearchSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateSaleDto, InventoryItem, Vendor } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { dashboardService } from '@/lib/services/dashboard.service';
import { format } from 'date-fns';
import { formatAmount } from '@/lib/utils';

const saleSchema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.preprocess((v) => Number(String(v).replace(/,/g, '')), z.number().min(0, 'Required')),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().regex(/^\d{11}$/, 'Phone must be exactly 11 digits'),
  customerEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.email('Invalid email').optional()
  ),
  customerId: z.string().optional(),
  accountPaidTo: z.string().min(1, 'Required'),
});

type SaleFormInput = z.input<typeof saleSchema>;
type SaleFormOutput = z.output<typeof saleSchema>;

interface Props {
  onSubmit: (data: CreateSaleDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function SaleForm({ onSubmit, isLoading, onCancel }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  // Customer search state
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

  // Close dropdown on outside click
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
  } = useForm<SaleFormInput, unknown, SaleFormOutput>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const inventoryId = useWatch({ control, name: 'inventoryId', defaultValue: '' });
  const { field: phoneField } = useController({ control, name: 'customerPhone', defaultValue: '' });
  const { field: nameField } = useController({ control, name: 'customerName', defaultValue: '' });
  const phoneLength = phoneField.value?.length ?? 0;

  const selectedItem = inventory.find((i) => i.id === inventoryId) ?? null;

  const handleNameChange = (val: string) => {
    const capitalized = val.replace(/\b\w/g, (c) => c.toUpperCase());
    nameField.onChange(capitalized);
    val = capitalized;
    // Clear customerId when user types manually
    setValue('customerId', undefined);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await dashboardService.searchCustomers(val);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 100);
  };

  const handleSelectCustomer = (customer: Vendor) => {
    setValue('customerName', customer.customerName, { shouldValidate: true });
    setValue('customerId', customer.id);
    phoneField.onChange(customer.customerPhone ?? '');
    setValue('customerEmail', customer.customerEmail ?? '', { shouldValidate: true });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const field = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Inventory picker */}
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium">Inventory Item</label>
          <input type="hidden" {...register('inventoryId')} />
          <InventorySearchSelect
            items={inventory}
            value={inventoryId}
            onChange={(id) => {
              setValue('inventoryId', id, { shouldValidate: true });
              const item = inventory.find((i) => i.id === id);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (item) setValue('amount', formatAmount(item.sellingPrice) as any, { shouldValidate: true });
            }}
            disabled={loadingInventory}
            placeholder={loadingInventory ? 'Loading…' : 'Select an item'}
          />
          {errors.inventoryId && (
            <p className="text-xs text-destructive">{errors.inventoryId.message}</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input {...register('date')} type="date" className={field} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Amount (₦)</label>
          <input {...register('amount')} type="text" inputMode="decimal" className={field} />
          {errors.amount ? (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          ) : selectedItem ? (
            <p className="text-xs text-muted-foreground">
              Selling price: ₦{selectedItem.sellingPrice.toLocaleString()}
            </p>
          ) : null}
        </div>

        {/* Customer Name with autocomplete */}
        <div className="space-y-1 relative" ref={suggestionsRef}>
          <label className="text-sm font-medium">Customer Name</label>
          <input
            {...nameField}
            type="text"
            autoComplete="off"
            className={field}
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
                  <p className="text-sm font-medium text-foreground">{c.customerName}</p>
                  <p className="text-xs text-muted-foreground">{c.customerPhone}{c.customerEmail ? ` · ${c.customerEmail}` : ''}</p>
                </button>
              ))}
            </div>
          )}
          {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
        </div>

        {/* Customer Phone */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Customer Phone</label>
          <div className="relative">
            <input
              {...phoneField}
              type="text"
              inputMode="numeric"
              maxLength={11}
              className={`${field} pr-14`}
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
              phoneLength === 11 ? 'text-green-600' : phoneLength > 0 ? 'text-muted-foreground' : 'text-muted-foreground/50'
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

        {/* Customer Email (optional) */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Customer Email <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input {...register('customerEmail')} type="email" className={field} />
          {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail.message}</p>}
        </div>

        {/* Account Paid To */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Account Paid To</label>
          <input {...register('accountPaidTo')} type="text" className={field} />
          {errors.accountPaidTo && <p className="text-xs text-destructive">{errors.accountPaidTo.message}</p>}
        </div>

      </div>

      <input type="hidden" {...register('customerId')} />

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Record Sale'}
        </button>
      </div>
    </form>
  );
}
