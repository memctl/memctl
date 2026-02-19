import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="dash-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-xl bg-[#F97316]/10 p-4 shadow-[0_0_16px_rgba(249,115,22,0.08)]">
        <Icon className="h-8 w-8 text-[#F97316]" />
      </div>
      <h3 className="mb-1 font-mono text-sm font-bold text-[var(--landing-text)]">
        {title}
      </h3>
      <p className="mb-6 max-w-sm text-sm text-[var(--landing-text-tertiary)]">
        {description}
      </p>
      {children}
    </div>
  );
}
