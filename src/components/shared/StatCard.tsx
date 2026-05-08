interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType<{ size?: number; className?: string }>;
  accentColor: string;
  iconBg: string;
  iconColor: string;
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, accentColor, iconBg, iconColor, className = '' }: StatCardProps) {
  return (
    <div
      className={`relative rounded-2xl border border-border bg-card p-5 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${className}`}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
          opacity: 0.13,
        }}
      />
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl"
        style={{ backgroundColor: accentColor, opacity: 0.15 }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground leading-tight pr-1">{label}</p>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}
