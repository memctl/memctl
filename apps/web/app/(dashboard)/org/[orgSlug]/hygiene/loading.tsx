import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  ChartSkeleton,
  ListCardSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function HygieneLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription />

      {/* Top row: Capacity + Health Distribution */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="dash-card glass-border space-y-3 p-4">
          <Skeleton className={`h-4 w-32 rounded ${S}`} />
          <Skeleton className={`h-10 w-24 rounded ${S}`} />
          <Skeleton className={`h-2 w-full rounded-full ${S}`} />
          <Skeleton className={`h-3 w-20 rounded ${S}`} />
        </div>
        <div className="dash-card glass-border space-y-3 p-4">
          <Skeleton className={`h-4 w-36 rounded ${S}`} />
          {/* Health buckets */}
          <div className="flex gap-1">
            {[40, 60, 80, 100].map((w, i) => (
              <Skeleton
                key={i}
                className={`h-6 rounded ${S}`}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className={`h-2 w-2 rounded-full ${S}`} />
                <Skeleton className={`h-2.5 w-12 rounded ${S}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stale + Expiring lists */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <ListCardSkeleton rows={5} />
        <ListCardSkeleton rows={5} />
      </div>

      {/* Growth chart */}
      <div className="mb-4">
        <ChartSkeleton height={180} />
      </div>

      {/* Table sizes + cleanup */}
      <div className="flex items-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="dash-card glass-border space-y-1 p-3">
            <Skeleton className={`h-3 w-20 rounded ${S}`} />
            <Skeleton className={`h-5 w-10 rounded ${S}`} />
          </div>
        ))}
        <div className="ml-auto">
          <Skeleton className={`h-9 w-32 rounded ${S}`} />
        </div>
      </div>
    </div>
  );
}
