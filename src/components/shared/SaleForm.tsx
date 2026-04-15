'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateSaleDto, SaleCondition, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { format } from 'date-fns';

const saleSchema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required'),
  condition: z.enum(SaleCondition),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().min(1, 'Required'),
  customerEmail: z.email('Invalid email').optional().or(z.literal('')),
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
    formState: { errors },
  } = useForm<SaleFormInput, unknown, SaleFormOutput>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      condition: SaleCondition.NEW,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Inventory picker */}
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium">Inventory Item</label>
          <select
            {...register('inventoryId')}
            disabled={loadingInventory}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">
              {loadingInventory ? 'Loading...' : 'Select an item'}
            </option>
            {inventory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.productName} — {item.serialNumber} ({item.imei})
              </option>
            ))}
          </select>
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
          <label className="text-sm font-medium">Amount</label>
          <input
            {...register('amount')}
            type="number"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
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
          <input
            {...register('customerPhone')}
            type="text"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.customerPhone && (
            <p className="text-xs text-destructive">
              {errors.customerPhone.message}
            </p>
          )}
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
