import { DashboardStats } from "@/lib/services/dashboard.service";

interface Props {
  credits: DashboardStats["credits"];
}

export default function CreditsCards({ credits }: Props) {
  const cards = [
    { label: "Total Credits", value: credits.total },
    { label: "Paid Credits", value: credits.paid },
    { label: "Outstanding (₦)", value: `₦${(credits.outstanding ?? 0).toLocaleString()}` },
    { label: "Overdue", value: credits.overdue },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map(({ label, value }) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}
