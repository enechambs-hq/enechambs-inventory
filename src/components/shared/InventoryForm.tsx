'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateInventoryDto, InventoryItem } from '@/types';
import { format } from 'date-fns';

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

const inventorySchema = z.object({
  dateAdded: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  imei: z
    .string()
    .min(1, 'Required')
    .regex(/^\d+$/, 'IMEI must contain numbers only')
    .min(15, 'IMEI must be exactly 15 digits')
    .max(15, 'IMEI must be exactly 15 digits'),
  storageGB: z.string().min(1, 'Required'),
  color: z.string().min(1, 'Required'),
  productType: z.string().min(1, 'Required'),
  companyName: z.string().min(1, 'Required'),
  costPrice: z.coerce.number().min(0, 'Required'),
  sellingPrice: z.coerce.number().min(0, 'Required'),
  thresholdPrice: z.coerce.number().min(0, 'Required'),
});

type InventoryFormInput = z.input<typeof inventorySchema>;
type InventoryFormOutput = z.output<typeof inventorySchema>;

interface Props {
  defaultValues?: InventoryItem;
  onSubmit: (data: CreateInventoryDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

const fields: { name: keyof InventoryFormInput; label: string; type?: string }[] = [
  { name: 'dateAdded', label: 'Date Added', type: 'date' },
  { name: 'productName', label: 'Product Name' },
  { name: 'imei', label: 'IMEI' },
  { name: 'storageGB', label: 'Storage' },
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
    control,
    formState: { errors },
  } = useForm<InventoryFormInput, unknown, InventoryFormOutput>({
    resolver: zodResolver(inventorySchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          storageGB: defaultValues.storageGB,
          dateAdded: format(new Date(defaultValues.dateAdded), 'yyyy-MM-dd'),
        }
      : { dateAdded: format(new Date(), 'yyyy-MM-dd') },
  });

  const imeiValue = useWatch({ control, name: 'imei', defaultValue: '' });
  const imeiLength = imeiValue?.length ?? 0;
  const isImeiReadOnly = !!defaultValues;

  const handleFormSubmit = handleSubmit((data) => {
    // Transform dateAdded from yyyy-MM-dd (HTML input) to dd-MM-yyyy (backend)
    const [year, month, day] = data.dateAdded.split('-');
    return onSubmit({ ...data, dateAdded: `${day}-${month}-${year}` } as CreateInventoryDto);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ name, label, type }) => {
          const isReadOnly = name === 'imei' && isImeiReadOnly;

          if (name === 'storageGB') {
            return (
              <div key={name} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <select
                  {...register('storageGB')}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select storage</option>
                  {STORAGE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.storageGB && (
                  <p className="text-xs text-destructive">{errors.storageGB.message}</p>
                )}
              </div>
            );
          }

          if (name === 'imei') {
            return (
              <div key={name} className="space-y-1">
                <label className="text-sm font-medium">
                  {label}
                  {isReadOnly && (
                    <span className="ml-1 text-xs text-muted-foreground font-normal">(cannot be changed)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    {...register('imei')}
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    readOnly={isReadOnly}
                    onKeyDown={(e) => {
                      // Block non-numeric keys (allow backspace, delete, arrows, tab)
                      const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
                      if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
                        e.preventDefault();
                      }
                      // Stop typing at 15 digits
                      if (imeiLength >= 15 && !allowed.includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      // Strip non-digits from paste and cap at 15
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 15);
                      const nativeInput = e.target as HTMLInputElement;
                      const start = nativeInput.selectionStart ?? 0;
                      const end = nativeInput.selectionEnd ?? 0;
                      const current = nativeInput.value;
                      const next = (current.slice(0, start) + pasted + current.slice(end)).slice(0, 15);
                      nativeInput.value = next;
                      nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }}
                    className={`w-full px-3 py-2 pr-14 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                  {!isReadOnly && (
                    <span
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${
                        imeiLength === 15
                          ? 'text-green-600'
                          : imeiLength > 0
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/50'
                      }`}
                    >
                      {imeiLength}/15
                    </span>
                  )}
                </div>
                {errors.imei ? (
                  <p className="text-xs text-destructive">{errors.imei.message}</p>
                ) : imeiLength > 0 && imeiLength < 15 ? (
                  <p className="text-xs text-amber-500">{15 - imeiLength} more digit{15 - imeiLength !== 1 ? 's' : ''} needed</p>
                ) : null}
              </div>
            );
          }

          return (
            <div key={name} className="space-y-1">
              <label className="text-sm font-medium">
                {label}
                {isReadOnly && (
                  <span className="ml-1 text-xs text-muted-foreground font-normal">(cannot be changed)</span>
                )}
              </label>
              <input
                {...register(name)}
                type={type || 'text'}
                readOnly={isReadOnly}
                className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                  isReadOnly ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
              {errors[name] && (
                <p className="text-xs text-destructive">{errors[name]?.message}</p>
              )}
            </div>
          );
        })}
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
