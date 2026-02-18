import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "dash-card glass-border relative overflow-hidden p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--landing-text-tertiary)]">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold text-[var(--landing-text)]">
            {value}
          </p>
          {trend && (
            <p className="mt-1 font-mono text-xs text-[#F97316]">{trend}</p>
          )}
        </div>
        <div className="rounded-lg bg-[#F97316]/10 p-2.5">
          <Icon className="h-5 w-5 text-[#F97316]" />
        </div>
      </div>
    </div>
  );
}
