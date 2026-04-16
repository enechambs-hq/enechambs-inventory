interface StockLevels {
  total: number;
  available: number;
  sold: number;
}

interface Props {
  stockLevels: StockLevels;
}

export default function StockLevelCards({ stockLevels }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Total Stock', value: stockLevels.total },
        { label: 'Available', value: stockLevels.available },
        { label: 'Sold', value: stockLevels.sold },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}
