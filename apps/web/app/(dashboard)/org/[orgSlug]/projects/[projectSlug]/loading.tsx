import { Skeleton } from "@/components/ui/skeleton";
import { MemoriesSkeleton } from "@/components/dashboard/tab-skeletons";

const S = "bg-[var(--landing-surface-2)]";

export default function ProjectDetailLoading() {
  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className={`h-6 w-44 rounded ${S}`} />
          <Skeleton className={`mt-2 h-4 w-72 rounded ${S}`} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className={`h-7 w-24 rounded-md ${S}`} />
          <Skeleton className={`h-7 w-20 rounded-md ${S}`} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative mb-6 border-b border-[var(--landing-border)]">
        <div className="flex gap-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5 px-4 py-2.5">
              <Skeleton className={`h-3.5 w-3.5 rounded ${S}`} />
              <Skeleton
                className={`h-3 rounded ${S}`}
                style={{ width: [64, 48, 60, 56, 52][i] }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Default tab (memories) skeleton */}
      <MemoriesSkeleton />
    </div>
  );
}
