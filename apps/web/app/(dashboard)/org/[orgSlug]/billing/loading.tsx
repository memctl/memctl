import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardGrid,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function BillingLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeaderSkeleton hasDescription />

      {/* Current plan card */}
      <div className="dash-card glass-border mb-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className={`h-5 w-20 rounded-full ${S}`} />
          <Skeleton className={`h-5 w-16 rounded ${S}`} />
        </div>
        <StatCardGrid count={4} cols="sm:grid-cols-2 md:grid-cols-4" />
      </div>

      {/* Plan selector */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dash-card glass-border space-y-3 p-5">
            <Skeleton className={`h-4 w-16 rounded ${S}`} />
            <Skeleton className={`h-3 w-24 rounded ${S}`} />
            <Skeleton className={`h-6 w-20 rounded ${S}`} />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className={`h-3 w-3 rounded ${S}`} />
                  <Skeleton
                    className={`h-3 rounded ${S}`}
                    style={{ width: 80 + j * 12 }}
                  />
                </div>
              ))}
            </div>
            <Skeleton className={`mt-3 h-9 w-full rounded ${S}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
