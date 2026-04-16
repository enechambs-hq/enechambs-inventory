import { AlertTriangle } from 'lucide-react';
import { InventoryItem } from '@/types';

interface Props {
  items: InventoryItem[];
}

export default function LowStockAlert({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} className="text-yellow-500" />
        <p className="text-sm font-medium text-yellow-600">
          {items.length} low stock {items.length === 1 ? 'alert' : 'alerts'}
        </p>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="text-xs text-muted-foreground">
            {item.productName} — {item.companyName} ({item.color})
          </li>
        ))}
      </ul>
    </div>
  );
}
