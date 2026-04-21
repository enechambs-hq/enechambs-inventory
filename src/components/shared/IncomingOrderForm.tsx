'use client';

import { useEffect, useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CreateIncomingOrderDto, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { formatAmount } from '@/lib/utils';
import InventorySearchSelect from './InventorySearchSelect';

const schema = z.object({
  inventoryId: z.string().optional(),
  date: z.string().min(1, 'Required'),
  expiryDate: z.string().min(1, 'Required'),
  expectedAmount: z.preprocess((v) => Number(String(v).replace(/,/g, '')), z.number().min(0, 'Required')),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().regex(/^\d{11}$/, 'Phone must be exactly 11 digits'),
  customerEmail: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.email('Invalid email').optional()
  ),
  notes: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().optional()
  ),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  onSubmit: (data: CreateIncomingOrderDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function IncomingOrderForm({ onSubmit, isLoading, onCancel }: Props) {
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
      .then((res) => setInventory(res.data))
      .catch(() => {})
      .finally(() => setLoadingInventory(false));
  }, []);

  const { field: phoneField } = useController({ control, name: 'customerPhone', defaultValue: '' });
  const phoneLength = phoneField.value?.length ?? 0;
  const inventoryId = control._formValues?.inventoryId ?? '';

  const field = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  const handleFormSubmit = (data: FormOutput) => onSubmit(data as CreateIncomingOrderDto);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Inventory item (optional) */}
      <div className="space-y-1">
        <label className="text-sm font-medium">
          Inventory Item <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input type="hidden" {...register('inventoryId')} />
        <InventorySearchSelect
          items={inventory}
          value={inventoryId}
          onChange={(id) => {
              setValue('inventoryId', id, { shouldValidate: true });
              const item = inventory.find((i) => i.id === id);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (item) setValue('expectedAmount', formatAmount(item.sellingPrice) as any, { shouldValidate: true });
            }}
          disabled={loadingInventory}
          placeholder={loadingInventory ? 'Loading…' : 'Select an item (optional)'}
        />
      </div>

      {/* Date + Expiry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input type="date" {...register('date')} className={field} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Expiry Date</label>
          <input type="date" {...register('expiryDate')} className={field} />
          {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate.message}</p>}
        </div>
      </div>

      {/* Expected Amount */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Expected Amount (₦)</label>
        <input type="text" inputMode="decimal" {...register('expectedAmount')} className={field} placeholder="0" />
        {errors.expectedAmount && <p className="text-xs text-destructive">{errors.expectedAmount.message}</p>}
      </div>

      {/* Customer Name + Phone */}
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

      {/* Email */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Email <span className="text-muted-foreground">(optional)</span></label>
        <input type="email" {...register('customerEmail')} className={field} placeholder="customer@example.com" />
        {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail.message}</p>}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Notes <span className="text-muted-foreground">(optional)</span></label>
        <textarea {...register('notes')} rows={3} className={`${field} resize-none`} placeholder="Any additional details..." />
        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
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
          {isLoading ? 'Saving...' : 'Record Inquiry'}
        </button>
      </div>
    </form>
  );
}
