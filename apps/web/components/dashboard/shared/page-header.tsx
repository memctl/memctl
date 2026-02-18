interface PageHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  badge,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        {badge && (
          <span className="mb-2 inline-block font-mono text-[11px] font-medium uppercase tracking-widest text-[#F97316]">
            {badge}
          </span>
        )}
        <h1 className="font-mono text-2xl font-bold text-[var(--landing-text)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--landing-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
