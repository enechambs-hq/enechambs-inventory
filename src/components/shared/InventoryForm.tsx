'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Category, CreateInventoryDto, InventoryItem, InventoryUnit } from '@/types';
import { categoriesService } from '@/lib/services/categories.service';
import CustomSelect from '@/components/shared/CustomSelect';

const UNITS: InventoryUnit[] = ['kg', 'piece', 'litre', 'pack', 'bag', 'carton', 'dozen'];

const inventorySchema = z.object({
  productName: z.string().min(1, 'Required'),
  quantity: z.coerce.number().min(0, 'Required'),
  unit: z.enum(['kg', 'piece', 'litre', 'pack', 'bag', 'carton', 'dozen'] as const),
  costPrice: z.coerce.number().min(0, 'Required'),
  sellingPrice: z.coerce.number().min(0, 'Required'),
  categoryId: z.coerce.number().min(1, 'Required'),
  supplierRef: z.string().optional(),
  restockThreshold: z.coerce.number().min(0, 'Required'),
  expiryTracking: z.boolean().optional(),
  expiryDate: z.string().optional(),
  dateAdded: z.string().min(1, 'Required'),
});

type InventoryFormInput = z.input<typeof inventorySchema>;
type InventoryFormOutput = z.output<typeof inventorySchema>;

interface Props {
  defaultValues?: InventoryItem;
  onSubmit: (data: CreateInventoryDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

const inputClass = 'w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'text-sm font-medium';
const errorClass = 'text-xs text-destructive';

export default function InventoryForm({ defaultValues, onSubmit, isLoading, onCancel }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoriesService.getAll().then(setCategories).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<InventoryFormInput, unknown, InventoryFormOutput>({
    resolver: zodResolver(inventorySchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          expiryTracking: defaultValues.expiryTracking ?? false,
          expiryDate: defaultValues.expiryDate ?? '',
          supplierRef: defaultValues.supplierRef ?? '',
          dateAdded: format(new Date(defaultValues.dateAdded), 'yyyy-MM-dd'),
        }
      : {
          dateAdded: format(new Date(), 'yyyy-MM-dd'),
          restockThreshold: 10,
          expiryTracking: false,
        },
  });

  const expiryTracking = useWatch({ control, name: 'expiryTracking' });

  const handleFormSubmit = handleSubmit((data: InventoryFormOutput) => {
    const payload: CreateInventoryDto = {
      ...data,
      expiryTracking: data.expiryTracking ?? false,
      expiryDate: data.expiryTracking ? data.expiryDate : undefined,
      supplierRef: data.supplierRef || undefined,
    };
    return onSubmit(payload);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Product Name */}
        <div className="space-y-1 col-span-2">
          <label className={labelClass}>Product Name</label>
          <input {...register('productName')} type="text" className={inputClass} />
          {errors.productName && <p className={errorClass}>{errors.productName.message}</p>}
        </div>

        {/* Quantity */}
        <div className="space-y-1">
          <label className={labelClass}>Quantity</label>
          <input {...register('quantity')} type="number" min={0} className={inputClass} />
          {errors.quantity && <p className={errorClass}>{errors.quantity.message}</p>}
        </div>

        {/* Unit */}
        <div className="space-y-1">
          <label className={labelClass}>Unit</label>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <CustomSelect
                options={UNITS.map((u) => ({ value: u, label: u }))}
                value={field.value ?? ''}
                onChange={(v) => field.onChange(v)}
                placeholder="Select unit"
                hasError={!!errors.unit}
              />
            )}
          />
          {errors.unit && <p className={errorClass}>{errors.unit.message}</p>}
        </div>

        {/* Cost Price */}
        <div className="space-y-1">
          <label className={labelClass}>Cost Price (₦)</label>
          <input {...register('costPrice')} type="number" min={0} className={inputClass} />
          {errors.costPrice && <p className={errorClass}>{errors.costPrice.message}</p>}
        </div>

        {/* Selling Price */}
        <div className="space-y-1">
          <label className={labelClass}>Selling Price (₦)</label>
          <input {...register('sellingPrice')} type="number" min={0} className={inputClass} />
          {errors.sellingPrice && <p className={errorClass}>{errors.sellingPrice.message}</p>}
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className={labelClass}>Category</label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <CustomSelect
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={(field.value as number) || ''}
                onChange={(v) => field.onChange(Number(v))}
                placeholder="Select category"
                hasError={!!errors.categoryId}
              />
            )}
          />
          {errors.categoryId && <p className={errorClass}>{errors.categoryId.message}</p>}
        </div>

        {/* Supplier Ref */}
        <div className="space-y-1">
          <label className={labelClass}>Supplier Ref <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input {...register('supplierRef')} type="text" className={inputClass} />
        </div>

        {/* Restock Threshold */}
        <div className="space-y-1">
          <label className={labelClass}>Restock Threshold</label>
          <input {...register('restockThreshold')} type="number" min={0} className={inputClass} />
          {errors.restockThreshold && <p className={errorClass}>{errors.restockThreshold.message}</p>}
        </div>

        {/* Date Added */}
        <div className="space-y-1">
          <label className={labelClass}>Date Added</label>
          <input {...register('dateAdded')} type="date" className={inputClass} />
          {errors.dateAdded && <p className={errorClass}>{errors.dateAdded.message}</p>}
        </div>

        {/* Expiry Tracking toggle */}
        <div className="col-span-2 flex items-center gap-3 py-1">
          <input
            {...register('expiryTracking')}
            type="checkbox"
            id="expiryTracking"
            className="h-4 w-4 rounded border accent-primary"
          />
          <label htmlFor="expiryTracking" className={labelClass + ' cursor-pointer'}>
            Track expiry date
          </label>
        </div>

        {/* Expiry Date — only when expiryTracking is on */}
        {expiryTracking && (
          <div className="space-y-1 col-span-2">
            <label className={labelClass}>Expiry Date</label>
            <input {...register('expiryDate')} type="date" className={inputClass} />
            {errors.expiryDate && <p className={errorClass}>{errors.expiryDate.message}</p>}
          </div>
        )}
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
