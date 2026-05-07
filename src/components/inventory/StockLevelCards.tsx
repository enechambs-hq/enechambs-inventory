import { ShoppingCart, TrendingUp } from 'lucide-react';

interface Props {
  available: number;
  soldToday: number;
}

export default function StockLevelCards({ available, soldToday }: Props) {
  const cards = [
    {
      label: 'Available Now',
      value: available,
      icon: TrendingUp,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-500/10',
      valueColor: 'text-green-600',
    },
    {
      label: 'Sold Today',
      value: soldToday,
      icon: ShoppingCart,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      valueColor: 'text-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map(({ label, value, icon: Icon, iconColor, iconBg, valueColor }) => (
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
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
