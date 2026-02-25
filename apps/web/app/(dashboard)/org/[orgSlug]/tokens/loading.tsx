import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function TokensLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton hasDescription />

      {/* Create token row */}
      <div className="mb-6 flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className={`h-3 w-24 rounded ${S}`} />
          <Skeleton className={`h-9 w-full rounded ${S}`} />
        </div>
        <Skeleton className={`h-9 w-28 rounded ${S}`} />
      </div>

      {/* Token list + Quick Start */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Token list */}
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className={`h-4 w-20 rounded ${S}`} />
            <Skeleton className={`h-3 w-24 rounded ${S}`} />
          </div>
          <div className="divide-y divide-[var(--landing-border)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <div className="space-y-1">
                  <Skeleton className={`h-3.5 w-36 rounded ${S}`} />
                  <Skeleton className={`h-2.5 w-48 rounded ${S}`} />
                </div>
                <Skeleton className={`h-7 w-16 rounded ${S}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className={`h-4 w-24 rounded ${S}`} />
          <div className="dash-card glass-border space-y-2 p-3">
            <Skeleton className={`h-3 w-20 rounded ${S}`} />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-3 rounded ${S}`}
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
          <div className="dash-card glass-border space-y-2 p-3">
            <Skeleton className={`h-3 w-28 rounded ${S}`} />
            <Skeleton className={`h-8 w-full rounded ${S}`} />
            <Skeleton className={`h-3 w-48 rounded ${S}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
