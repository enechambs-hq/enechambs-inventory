'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateInventoryDto, InventoryItem } from '@/types';
import { format } from 'date-fns';

const inventorySchema = z.object({
  serialNumber: z.string().min(1, 'Required'),
  dateAdded: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  imei: z.string().min(1, 'Required'),
  storageGB: z.coerce.number().min(1, 'Required'),
  color: z.string().min(1, 'Required'),
  productType: z.string().min(1, 'Required'),
  companyName: z.string().min(1, 'Required'),
  costPrice: z.coerce.number().min(0, 'Required'),
  sellingPrice: z.coerce.number().min(0, 'Required'),
  thresholdPrice: z.coerce.number().min(0, 'Required'),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

interface Props {
  defaultValues?: InventoryItem;
  onSubmit: (data: CreateInventoryDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

const fields: { name: keyof InventoryFormData; label: string; type?: string }[] = [
  { name: 'serialNumber', label: 'Serial Number' },
  { name: 'dateAdded', label: 'Date Added', type: 'date' },
  { name: 'productName', label: 'Product Name' },
  { name: 'imei', label: 'IMEI' },
  { name: 'storageGB', label: 'Storage (GB)', type: 'number' },
  { name: 'color', label: 'Color' },
  { name: 'productType', label: 'Product Type' },
  { name: 'companyName', label: 'Company Name' },
  { name: 'costPrice', label: 'Cost Price', type: 'number' },
  { name: 'sellingPrice', label: 'Selling Price', type: 'number' },
  { name: 'thresholdPrice', label: 'Threshold Price', type: 'number' },
];

export default function InventoryForm({ defaultValues, onSubmit, isLoading, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          dateAdded: format(new Date(defaultValues.dateAdded), 'yyyy-MM-dd'),
        }
      : { dateAdded: format(new Date(), 'yyyy-MM-dd') },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ name, label, type }) => (
          <div key={name} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              {...register(name)}
              type={type || 'text'}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors[name] && (
              <p className="text-xs text-destructive">{errors[name]?.message}</p>
            )}
          </div>
        ))}
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
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}