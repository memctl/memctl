import { Skeleton } from "@/components/ui/skeleton";

const S = "bg-[var(--landing-surface-2)]";

export function PageHeaderSkeleton({
  hasDescription = true,
  hasActions = false,
}: {
  hasDescription?: boolean;
  hasActions?: boolean;
}) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <Skeleton className={`h-6 w-44 rounded ${S}`} />
        {hasDescription && (
          <Skeleton className={`mt-2 h-4 w-64 rounded ${S}`} />
        )}
      </div>
      {hasActions && <Skeleton className={`h-8 w-28 rounded ${S}`} />}
    </div>
  );
}

export function StatCardGrid({
  count = 6,
  cols = "sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dash-card glass-border space-y-2 p-3">
          <Skeleton className={`h-3 w-16 rounded ${S}`} />
          <Skeleton className={`h-5 w-10 rounded ${S}`} />
          <Skeleton className={`h-2.5 w-20 rounded ${S}`} />
        </div>
      ))}
    </div>
  );
}

export function ListCardSkeleton({
  rows = 5,
  title = true,
}: {
  rows?: number;
  title?: boolean;
}) {
  return (
    <div className="dash-card glass-border overflow-hidden">
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-3 py-2">
          <Skeleton className={`h-3.5 w-28 rounded ${S}`} />
          <Skeleton className={`h-3 w-12 rounded ${S}`} />
        </div>
      )}
      <div className="divide-y divide-[var(--landing-border)]">
        {Array.from({ length: rows }).map((_, i) => {
          const w = [180, 140, 200, 160, 120][i % 5];
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <Skeleton className={`h-2 w-2 shrink-0 rounded-full ${S}`} />
              <Skeleton className={`h-3 rounded ${S}`} style={{ width: w }} />
              <div className="ml-auto">
                <Skeleton className={`h-3 w-12 rounded ${S}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TableSkeleton({
  cols = 5,
  rows = 6,
}: {
  cols?: number;
  rows?: number;
}) {
  const colWidths = [140, 120, 80, 100, 60, 90, 70];
  return (
    <div className="overflow-x-auto">
      <div className="divide-y divide-[var(--landing-border)]">
        {/* Header */}
        <div className="flex items-center gap-4 px-3 py-2">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-3 rounded ${S}`}
              style={{ width: colWidths[i % colWidths.length] }}
            />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div
            key={ri}
            className="flex items-center gap-4 px-3 py-2"
            style={{ opacity: 1 - ri * 0.08 }}
          >
            {Array.from({ length: cols }).map((_, ci) => (
              <Skeleton
                key={ci}
                className={`h-3 rounded ${S}`}
                style={{
                  width:
                    colWidths[ci % colWidths.length] *
                    (0.7 + Math.random() * 0.3),
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="dash-card glass-border overflow-hidden">
      <div className="border-b border-[var(--landing-border)] px-3 py-2">
        <Skeleton className={`h-3.5 w-36 rounded ${S}`} />
      </div>
      <div className="p-4">
        <Skeleton className={`w-full rounded ${S}`} style={{ height }} />
      </div>
    </div>
  );
}

export function FormFieldSkeleton({ wide = true }: { wide?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={`h-3 w-20 rounded ${S}`} />
      <Skeleton
        className={`h-9 rounded ${S}`}
        style={{ width: wide ? "100%" : 280 }}
      />
    </div>
  );
}

export function CardSkeleton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`dash-card glass-border p-4 ${className}`}>{children}</div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="dash-card glass-border space-y-3 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className={`h-4 w-32 rounded ${S}`} />
        <Skeleton className={`h-5 w-16 rounded-md ${S}`} />
      </div>
      <Skeleton className={`h-3 w-full rounded ${S}`} />
      <Skeleton className={`h-3 w-3/4 rounded ${S}`} />
    </div>
  );
}
