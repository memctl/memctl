import { Skeleton } from "@/components/ui/skeleton";
import { ActivitySkeleton } from "@/components/activity/activity-skeleton";

const S = "bg-[var(--landing-surface-2)]";

export default function ActivityLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Skeleton className={`h-6 w-48 rounded ${S}`} />
        <Skeleton className={`mt-2 h-4 w-72 rounded ${S}`} />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className={`h-8 w-48 rounded ${S}`} />
        <Skeleton className={`h-8 w-32 rounded ${S}`} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={`h-6 w-16 rounded-full ${S}`} />
        ))}
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dash-card glass-border space-y-1.5 p-3">
            <Skeleton className={`h-3 w-16 rounded ${S}`} />
            <Skeleton className={`h-5 w-8 rounded ${S}`} />
          </div>
        ))}
      </div>

      {/* Feed */}
      <div className="dash-card glass-border overflow-hidden">
        <ActivitySkeleton rows={12} />
      </div>
    </div>
  );
}
