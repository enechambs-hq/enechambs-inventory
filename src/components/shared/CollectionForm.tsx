'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateCollectionDto, CollectionStatus } from '@/types';
import { format } from 'date-fns';

const collectionSchema = z.object({
  serialNumber: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  imei: z.string().min(1, 'Required'),
  storageGB: z.string().min(1, 'Required'),
  color: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required'),
  collectorName: z.string().min(1, 'Required'),
  status: z.nativeEnum(CollectionStatus),
});

type CollectionFormData = z.infer<typeof collectionSchema>;

interface Props {
  onSubmit: (data: CreateCollectionDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

export default function CollectionForm({ onSubmit, isLoading, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      status: CollectionStatus.PAID,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'serialNumber', label: 'Serial Number' },
          { name: 'date', label: 'Date', type: 'date' },
          { name: 'productName', label: 'Product Name' },
          { name: 'imei', label: 'IMEI' },
          { name: 'storageGB', label: 'Storage (GB)' },
          { name: 'color', label: 'Color' },
          { name: 'amount', label: 'Amount', type: 'number' },
          { name: 'collectorName', label: 'Collector Name' },
        ].map(({ name, label, type }) => (
          <div key={name} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              {...register(name as keyof CollectionFormData)}
              type={type || 'text'}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors[name as keyof CollectionFormData] && (
              <p className="text-xs text-destructive">
                {errors[name as keyof CollectionFormData]?.message}
              </p>
            )}
          </div>
        ))}

        {/* Status select */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select
            {...register('status')}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={CollectionStatus.PAID}>Paid</option>
            <option value={CollectionStatus.RETURNED}>Returned</option>
          </select>
          {errors.status && (
            <p className="text-xs text-destructive">{errors.status.message}</p>
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