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
    <div className="dash-card relative flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Diagonal hatching background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,var(--landing-border)_5px,var(--landing-border)_6px)] opacity-[0.4] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_30%,transparent_100%)]"
        aria-hidden="true"
      />
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
