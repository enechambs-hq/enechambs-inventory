'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateCreditDto, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { format } from 'date-fns';

const schema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required'),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().min(1, 'Required'),
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

  const handleFormSubmit = (data: FormOutput) => onSubmit(data as CreateCreditDto);

  const field = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Inventory item */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Item</label>
        <select {...register('inventoryId')} className={field} disabled={loadingInventory}>
          <option value="">{loadingInventory ? 'Loading...' : 'Select item'}</option>
          {inventory.map((item) => (
            <option key={item.id} value={item.id}>
              {item.productName} — {item.color}, {item.storageGB} (S/N: {item.serialNumber})
            </option>
          ))}
        </select>
        {errors.inventoryId && <p className="text-xs text-destructive">{errors.inventoryId.message}</p>}
      </div>

      {/* Date + Due Date */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Amount */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Amount (₦)</label>
        <input type="number" {...register('amount')} className={field} placeholder="0" min={0} />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>

      {/* Customer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Customer Name</label>
          <input type="text" {...register('customerName')} className={field} />
          {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <input type="tel" {...register('customerPhone')} className={field} />
          {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone.message}</p>}
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
