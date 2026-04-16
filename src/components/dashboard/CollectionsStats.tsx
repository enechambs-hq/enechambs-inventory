import { CollectionsStats } from "@/types";

interface Props {
  stats: CollectionsStats;
}

export default function CollectionsStatsCards({ stats }: Props) {
  const { allTime, thisMonth } = stats;

  const sections = [
    {
      label: "All Time",
      cards: [
        { label: "Total", value: allTime.total },
        { label: "Paid", value: allTime.paid },
        { label: "Pending", value: allTime.pending },
        { label: "Returned", value: allTime.returned },
        { label: "Revenue", value: `₦${allTime.totalRevenue.toLocaleString()}` },
        { label: "Conversion", value: `${allTime.conversionRate.toFixed(1)}%` },
      ],
    },
    {
      label: "This Month",
      cards: [
        { label: "Total", value: thisMonth.total },
        { label: "Paid", value: thisMonth.paid },
        { label: "Pending", value: thisMonth.pending },
        { label: "Returned", value: thisMonth.returned },
        { label: "Revenue", value: `₦${thisMonth.revenue.toLocaleString()}` },
        { label: "Conversion", value: `${thisMonth.conversionRate.toFixed(1)}%` },
      ],
    },
  ];

  return (
    <div>
      {sections.map(({ label, cards }, idx) => (
        <div key={label} className={idx < sections.length - 1 ? "mb-6" : ""}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            {label}
          </p>
          <div className="grid grid-cols-6 gap-3">
            {cards.map(({ label: cardLabel, value }) => (
              <div key={cardLabel} className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground mb-1">{cardLabel}</p>
                <p className="text-lg font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
