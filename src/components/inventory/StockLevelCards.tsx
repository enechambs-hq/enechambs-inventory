import { Package, ShoppingCart, TrendingUp } from 'lucide-react';

interface StockLevels {
  total: number;
  available: number;
  sold: number;
}

interface Props {
  stockLevels: StockLevels;
}

const CARDS = [
  {
    label: 'All Time Stock',
    key: 'total' as const,
    icon: Package,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-500/10',
    valueColor: 'text-blue-600',
  },
  {
    label: 'Available Now',
    key: 'available' as const,
    icon: TrendingUp,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-500/10',
    valueColor: 'text-green-600',
  },
  {
    label: 'Sold',
    key: 'sold' as const,
    icon: ShoppingCart,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-500/10',
    valueColor: 'text-red-500',
  },
];

export default function StockLevelCards({ stockLevels }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {CARDS.map(({ label, key, icon: Icon, iconColor, iconBg, valueColor }) => (
        <div
          key={label}
          className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={20} className={iconColor} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className={`text-3xl font-extrabold tracking-tight leading-none ${valueColor}`}>
              {stockLevels[key]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
