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
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">Collections</h2>
      {sections.map(({ label, cards }) => (
        <div key={label}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {label}
          </p>
          <div className="grid grid-cols-6 gap-3">
            {cards.map(({ label: cardLabel, value }) => (
              <div key={cardLabel} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{cardLabel}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
