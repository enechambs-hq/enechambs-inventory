import { DashboardStats } from "@/lib/services/dashboard.service";
import { CreditCard, Wallet, AlertCircle, TrendingUp } from "lucide-react";

interface Props {
  credits: DashboardStats["credits"];
}

const cards = [
  {
    key: "total",
    label: "Total Credits",
    icon: CreditCard,
    format: (v: number) => String(v),
  },
  {
    key: "paid",
    label: "Paid Credits",
    icon: TrendingUp,
    format: (v: number) => String(v),
  },
  {
    key: "outstanding",
    label: "Outstanding (₦)",
    icon: Wallet,
    format: (v: number) => `₦${v.toLocaleString()}`,
  },
  {
    key: "overdue",
    label: "Overdue",
    icon: AlertCircle,
    format: (v: number) => String(v),
  },
];

const iconColors: Record<string, string> = {
  total: "bg-primary/10 text-primary",
  paid: "bg-green-500/10 text-green-600",
  outstanding: "bg-yellow-500/10 text-yellow-600",
  overdue: "bg-red-500/10 text-red-600",
};

export default function CreditsCards({ credits }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ key, label, icon: Icon, format }) => {
        const value = (credits[key as keyof typeof credits] as number) ?? 0;
        return (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors[key]}`}
              >
                <Icon size={14} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{format(value)}</p>
          </div>
        );
      })}
    </div>
  );
}
