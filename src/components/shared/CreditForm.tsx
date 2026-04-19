'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateCreditDto, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { format } from 'date-fns';
import InventorySearchSelect from './InventorySearchSelect';

const schema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required'),
  amountPaid: z.coerce.number().min(0, 'Must be 0 or more').optional().default(0),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z
    .string()
    .regex(/^\d{11}$/, 'Phone must be exactly 11 digits'),
  customerEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.email('Invalid email').optional()
  ),
  dueDate: z.string().min(1, 'Required'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  onSubmit: (data: CreateCreditDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function CreditForm({ onSubmit, isLoading, onCancel }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  useEffect(() => {
    inventoryService
      .getAll({ page: 1, limit: 100 })
      .then((res) => setInventory(res.data.filter((i) => i.isAvailable)))
      .catch(() => {})
      .finally(() => setLoadingInventory(false));
  }, []);

  const inventoryId = useWatch({ control, name: 'inventoryId', defaultValue: '' });
  const amountValue = useWatch({ control, name: 'amount', defaultValue: 0 });
  const { field: phoneField } = useController({ control, name: 'customerPhone', defaultValue: '' });
  const phoneLength = phoneField.value?.length ?? 0;

  const selectedItem = inventory.find((i) => i.id === inventoryId) ?? null;
  const belowThreshold = selectedItem && Number(amountValue) > 0 && Number(amountValue) < selectedItem.thresholdPrice;

  const handleFormSubmit = (data: FormOutput) => onSubmit(data as CreateCreditDto);

  const field = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Inventory item */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Item</label>
        {/* hidden input keeps react-hook-form validation wired */}
        <input type="hidden" {...register('inventoryId')} />
        <InventorySearchSelect
          items={inventory}
          value={inventoryId}
          onChange={(id) => {
            setValue('inventoryId', id, { shouldValidate: true });
            const item = inventory.find((i) => i.id === id);
            if (item) setValue('amount', item.sellingPrice, { shouldValidate: true });
          }}
          disabled={loadingInventory}
          placeholder={loadingInventory ? 'Loading…' : 'Select an item'}
        />
        {errors.inventoryId && <p className="text-xs text-destructive">{errors.inventoryId.message}</p>}
      </div>

      {/* Date + Due Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input type="date" {...register('date')} className={field} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Due Date</label>
          <input type="date" {...register('dueDate')} className={field} />
          {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
        </div>
      </div>

      {/* Amount + Amount Paid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Total Amount (₦)</label>
          <input type="number" {...register('amount')} className={field} placeholder="0" min={0} />
          {errors.amount ? (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          ) : belowThreshold ? (
            <p className="text-xs text-amber-500 font-medium">
              ⚠ Below threshold — min is ₦{selectedItem!.thresholdPrice.toLocaleString()}
            </p>
          ) : selectedItem ? (
            <p className="text-xs font-semibold text-orange-500">
              Floor price: ₦{selectedItem.thresholdPrice.toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Initial Deposit (₦) <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input type="number" {...register('amountPaid')} className={field} placeholder="0" min={0} />
          {errors.amountPaid && <p className="text-xs text-destructive">{errors.amountPaid.message}</p>}
        </div>
      </div>

      {/* Customer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Customer Name</label>
          <input type="text" {...register('customerName')} className={field} />
          {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
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
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Email <span className="text-muted-foreground">(optional)</span></label>
        <input type="email" {...register('customerEmail')} className={field} placeholder="customer@example.com" />
        {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border text-sm hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Record Credit'}
        </button>
      </div>
    </form>
  );
}
