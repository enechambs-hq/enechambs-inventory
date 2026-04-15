'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateCollectionDto, InventoryItem } from '@/types';
import { inventoryService } from '@/lib/services/inventory.service';
import { format } from 'date-fns';

const collectionSchema = z.object({
  inventoryId: z.string().min(1, 'Select an inventory item'),
  date: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required').pipe(z.number()),
  collectorName: z.string().min(1, 'Required'),
});

type CollectionFormInput = z.input<typeof collectionSchema>;
type CollectionFormOutput = z.output<typeof collectionSchema>;

interface Props {
  onSubmit: (data: CreateCollectionDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function CollectionForm({
  onSubmit,
  isLoading,
  onCancel,
}: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  useEffect(() => {
    inventoryService
      .getAvailableForSale()
      .then((items) => setInventory(items))
      .catch(() => setInventory([]))
      .finally(() => setLoadingInventory(false));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CollectionFormInput, unknown, CollectionFormOutput>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
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

        {/* Collector Name */}
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium">Collector Name</label>
          <input
            {...register('collectorName')}
            type="text"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.collectorName && (
            <p className="text-xs text-destructive">
              {errors.collectorName.message}
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
          {isLoading ? 'Saving...' : 'Record Collection'}
        </button>
      </div>
    </form>
  );
}
