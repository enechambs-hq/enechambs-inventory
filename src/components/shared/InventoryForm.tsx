'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller, useController } from 'react-hook-form';
import { NumericInput } from '@/components/shared/NumericInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Category, CreateInventoryDto, InventoryItem, InventoryUnit } from '@/types';
import { categoriesService } from '@/lib/services/categories.service';
import CustomSelect from '@/components/shared/CustomSelect';

const UNITS: InventoryUnit[] = ['carton', 'bag', 'bottle', 'pack', 'piece', 'dozen', 'gallon', 'crate', 'bucket', 'box'];

/**
 * Normalises a money field before validation.
 *
 * NumericInput emits a raw, comma-formatted string, and `z.coerce.number()`
 * turns '' into 0 — which would let a blank cost price through as a real zero.
 * The business rule is that cost price is always known, so blank is mapped to
 * undefined and rejected rather than defaulted. A deliberately entered 0 is
 * still accepted, matching the backend's @Min(0).
 */
const toMoney = (v: unknown): unknown => {
  if (v === null) return undefined;
  if (typeof v === 'string') {
    const trimmed = v.replace(/,/g, '').trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isNaN(n) ? trimmed : n;
  }
  return v;
};

const inventorySchema = z.object({
  productName: z.string().min(1, 'Required'),
  quantity: z.coerce.number().min(0, 'Required'),
  unit: z.enum(['carton', 'bag', 'bottle', 'pack', 'piece', 'dozen', 'gallon', 'crate', 'bucket', 'box'] as const),
  variant: z.string().min(1, 'Required'),
  costPrice: z.preprocess(
    toMoney,
    z
      .number({
        error: (iss) =>
          iss.input === undefined
            ? 'Cost price is required'
            : 'Enter a valid cost price',
      })
      .min(0, 'Cost price cannot be negative'),
  ),
  // Same treatment as costPrice, and for the same reason: z.coerce.number()
  // turns '' into 0, so a blank selling price passed validation as a real price
  // of nothing. Every sale of such a product then booked ₦0 of revenue against
  // a real cost. The API rejects it now too; this keeps the message on the
  // field instead of surfacing as a server error.
  sellingPrice: z.preprocess(
    toMoney,
    z
      .number({
        error: (iss) =>
          iss.input === undefined
            ? 'Selling price is required'
            : 'Enter a valid selling price',
      })
      .min(0, 'Selling price cannot be negative'),
  ),
  categoryId: z.coerce.number().min(1, 'Required'),
  supplierRef: z.string().optional(),
  restockThreshold: z.coerce.number().min(1, 'Must be at least 1'),
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
          variant: defaultValues.variant ?? '',
          expiryTracking: defaultValues.expiryTracking ?? false,
          expiryDate: defaultValues.expiryDate ?? '',
          supplierRef: defaultValues.supplierRef ?? '',
          dateAdded: format(new Date(defaultValues.dateAdded), 'yyyy-MM-dd'),
        }
      : {
          dateAdded: format(new Date(), 'yyyy-MM-dd'),
          restockThreshold: 10,
          expiryTracking: false,
          variant: '',
        },
  });

  const expiryTracking = useWatch({ control, name: 'expiryTracking' });
  const productNameWatch = useWatch({ control, name: 'productName' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = control as any;
  const { field: qtyField } = useController({ control: c, name: 'quantity' });
  // defaultValues is only passed when an existing product is being edited.
  const isEditing = Boolean(defaultValues);
  const { field: costField } = useController({ control: c, name: 'costPrice' });
  const { field: sellField } = useController({ control: c, name: 'sellingPrice' });
  const { field: threshField } = useController({ control: c, name: 'restockThreshold' });
  const { field: variantField } = useController({ control: c, name: 'variant' });

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

        {/* Size / Variant */}
        <div className="space-y-1 col-span-2">
          <label className={labelClass}>Size / Variant</label>
          <input
            {...variantField}
            type="text"
            placeholder="e.g. 5kg, 25 litres, 50kg"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Distinguishes this product from other sizes of the same item
          </p>
          {errors.variant && (
            <p className={errorClass}>{errors.variant.message}</p>
          )}
        </div>

        {/* Live preview */}
        {(productNameWatch || variantField.value) && (
          <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border text-sm">
            <span className="text-muted-foreground text-xs">Will appear as →</span>
            <span className="font-medium">{productNameWatch || ''}</span>
            {variantField.value && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20">
                {variantField.value}
              </span>
            )}
          </div>
        )}

        {/* Quantity — opening stock, and only when the product is first added.
            Editing a product must not touch its stock: the figure loaded into
            this form goes stale the moment anything is sold, and saving it back
            would undo that sale. Stock moves through selling and restocking. */}
        {isEditing ? (
          <div className="space-y-1">
            <label className={labelClass}>Quantity in stock</label>
            <div className={`${inputClass} bg-muted/40 flex items-center justify-between`}>
              <span>
                {defaultValues?.quantity} {defaultValues?.unit}
                {Number(defaultValues?.quantity) === 1 ? '' : 's'}
              </span>
              <span className="text-[11px] text-muted-foreground">not editable here</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stock changes when you record a sale or restock the product.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <label className={labelClass}>Quantity</label>
            <NumericInput
              value={qtyField.value}
              onChange={(v) => qtyField.onChange(v)}
              onBlur={qtyField.onBlur}
              name={qtyField.name}
              decimals={false}
              className={inputClass}
            />
            {errors.quantity && <p className={errorClass}>{errors.quantity.message}</p>}
          </div>
        )}

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
          <label className={labelClass} htmlFor="costPrice">
            Cost Price (₦) <span className="text-destructive">*</span>
          </label>
          <NumericInput
            id="costPrice"
            value={costField.value}
            onChange={(v) => costField.onChange(v)}
            onBlur={costField.onBlur}
            name={costField.name}
            decimals={true}
            aria-required="true"
            aria-invalid={errors.costPrice ? true : undefined}
            className={inputClass}
          />
          {errors.costPrice && <p className={errorClass}>{errors.costPrice.message}</p>}
        </div>

        {/* Selling Price */}
        <div className="space-y-1">
          <label className={labelClass} htmlFor="sellingPrice">
            Selling Price (₦) *
          </label>
          <NumericInput
            id="sellingPrice"
            value={sellField.value}
            onChange={(v) => sellField.onChange(v)}
            onBlur={sellField.onBlur}
            name={sellField.name}
            decimals={true}
            className={inputClass}
            aria-required
            aria-invalid={errors.sellingPrice ? true : undefined}
          />
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
          <NumericInput
            value={threshField.value}
            onChange={(v) => threshField.onChange(v)}
            onBlur={threshField.onBlur}
            name={threshField.name}
            decimals={false}
            className={inputClass}
          />
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
