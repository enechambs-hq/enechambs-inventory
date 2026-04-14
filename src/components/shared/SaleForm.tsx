'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateSaleDto, SaleCondition } from '@/types';
import { format } from 'date-fns';

const saleSchema = z.object({
  serialNumber: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
  productName: z.string().min(1, 'Required'),
  imei: z.string().min(1, 'Required'),
  storageGB: z.string().min(1, 'Required'),
  color: z.string().min(1, 'Required'),
  amount: z.coerce.number().min(0, 'Required'),
  costPrice: z.coerce.number().min(0, 'Required'),
  thresholdPrice: z.coerce.number().min(0, 'Required'),
  condition: z.nativeEnum(SaleCondition),
  customerName: z.string().min(1, 'Required'),
  customerPhone: z.string().min(1, 'Required'),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
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
        {[
          { name: 'serialNumber', label: 'Serial Number' },
          { name: 'date', label: 'Date', type: 'date' },
          { name: 'productName', label: 'Product Name' },
          { name: 'imei', label: 'IMEI' },
          { name: 'storageGB', label: 'Storage (GB)' },
          { name: 'color', label: 'Color' },
          { name: 'amount', label: 'Amount', type: 'number' },
          { name: 'costPrice', label: 'Cost Price', type: 'number' },
          { name: 'thresholdPrice', label: 'Threshold Price', type: 'number' },
          { name: 'customerName', label: 'Customer Name' },
          { name: 'customerPhone', label: 'Customer Phone' },
          { name: 'customerEmail', label: 'Customer Email (optional)' },
          { name: 'accountPaidTo', label: 'Account Paid To' },
        ].map(({ name, label, type }) => (
          <div key={name} className="space-y-1">
            <label className="text-sm font-medium">{label}</label>
            <input
              {...register(name as keyof SaleFormInput)}
              type={type || 'text'}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors[name as keyof SaleFormInput] && (
              <p className="text-xs text-destructive">
                {errors[name as keyof SaleFormInput]?.message}
              </p>
            )}
          </div>
        ))}

        {/* Condition select */}
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
            <p className="text-xs text-destructive">{errors.condition.message}</p>
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