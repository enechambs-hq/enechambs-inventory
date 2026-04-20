'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, useController } from 'react-hook-form';
import InventorySearchSelect from './InventorySearchSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateSaleDto, SaleCondition, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { format } from 'date-fns';
import { formatAmount } from '@/lib/utils';

const saleSchema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.preprocess((v) => Number(String(v).replace(/,/g, '')), z.number().min(0, 'Required')),
  condition: z.enum(SaleCondition),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().regex(/^\d{11}$/, 'Phone must be exactly 11 digits'),
  customerEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.email('Invalid email').optional()
  ),
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

  useEffect(() => {
    inventoryService
      .getAvailableForSale()
      .then((items) => setInventory(items ?? []))
      .catch(() => setInventory([]))
      .finally(() => setLoadingInventory(false));
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
      condition: SaleCondition.NEW,
    },
  });

  const inventoryId = useWatch({ control, name: 'inventoryId', defaultValue: '' });
  const amountValue = useWatch({ control, name: 'amount', defaultValue: 0 });
  const { field: phoneField } = useController({ control, name: 'customerPhone', defaultValue: '' });
  const phoneLength = phoneField.value?.length ?? 0;

  const selectedItem = inventory.find((i) => i.id === inventoryId) ?? null;
  const belowThreshold = selectedItem && Number(amountValue) > 0 && Number(amountValue) < selectedItem.thresholdPrice;

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
            <p className="text-xs text-destructive">
              {errors.inventoryId.message}
            </p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input
            {...register('date')}
            type="date"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Amount (₦)</label>
          <input
            {...register('amount')}
            type="text"
            inputMode="decimal"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.amount ? (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          ) : belowThreshold ? (
            <p className="text-xs text-amber-500 font-medium">
              ⚠ Below threshold — min is ₦{formatAmount(selectedItem!.thresholdPrice)}
            </p>
          ) : selectedItem ? (
            <p className="text-xs font-semibold text-orange-500">
              Floor price: ₦{selectedItem.thresholdPrice.toLocaleString()}
            </p>
          ) : null}
        </div>

        {/* Condition */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Condition</label>
          <select
            {...register('condition')}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={SaleCondition.NEW}>New</option>
            <option value={SaleCondition.USED}>Used</option>
          </select>
          {errors.condition && (
            <p className="text-xs text-destructive">
              {errors.condition.message}
            </p>
          )}
        </div>

        {/* Customer Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Customer Name</label>
          <input
            {...register('customerName')}
            type="text"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.customerName && (
            <p className="text-xs text-destructive">
              {errors.customerName.message}
            </p>
          )}
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
              className="w-full px-3 py-2 pr-14 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            Customer Email{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            {...register('customerEmail')}
            type="email"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.customerEmail && (
            <p className="text-xs text-destructive">
              {errors.customerEmail.message}
            </p>
          )}
        </div>

        {/* Account Paid To */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Account Paid To</label>
          <input
            {...register('accountPaidTo')}
            type="text"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.accountPaidTo && (
            <p className="text-xs text-destructive">
              {errors.accountPaidTo.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
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
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Record Sale'}
        </button>
      </div>
    </form>
  );
}
