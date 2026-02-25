import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  ChartSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function HealthLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription />

      {/* System checks grid */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="dash-card glass-border flex items-center gap-3 p-3"
          >
            <Skeleton className={`h-5 w-5 shrink-0 rounded-full ${S}`} />
            <div className="space-y-1">
              <Skeleton className={`h-3 w-24 rounded ${S}`} />
              <Skeleton className={`h-2.5 w-36 rounded ${S}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Capacity + Priority */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="dash-card glass-border space-y-3 p-4">
          <Skeleton className={`h-4 w-32 rounded ${S}`} />
          <Skeleton className={`h-8 w-20 rounded ${S}`} />
          <Skeleton className={`h-2 w-full rounded-full ${S}`} />
          <Skeleton className={`h-3 w-16 rounded ${S}`} />
        </div>
        <ChartSkeleton height={120} />
      </div>

      {/* Charts */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <ChartSkeleton height={160} />
        <ChartSkeleton height={160} />
      </div>

      {/* Project stats table */}
      <div className="dash-card glass-border overflow-hidden">
        <div className="border-b border-[var(--landing-border)] px-3 py-2">
          <Skeleton className={`h-3.5 w-28 rounded ${S}`} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--landing-border)] px-3 py-2 last:border-b-0"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <Skeleton className={`h-3 w-28 rounded ${S}`} />
            <Skeleton className={`h-3 w-8 rounded ${S}`} />
            <Skeleton className={`h-3 w-8 rounded ${S}`} />
            <Skeleton className={`h-3 w-8 rounded ${S}`} />
            <Skeleton className={`h-3 w-8 rounded ${S}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
