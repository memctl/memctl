interface PageHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold text-[var(--landing-text)]">
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
