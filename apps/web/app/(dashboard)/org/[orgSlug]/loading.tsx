import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardGrid,
  ListCardSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function OrgDashboardLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription />

      {/* Stat cards */}
      <div className="mb-4">
        <StatCardGrid count={6} />
      </div>

      {/* 3-column grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: 2 stacked lists */}
        <div className="space-y-4 lg:col-span-2">
          <ListCardSkeleton rows={6} />
          <ListCardSkeleton rows={4} />
        </div>

        {/* Right: stacked cards */}
        <div className="space-y-4">
          {/* Quick links */}
          <div className="dash-card glass-border overflow-hidden">
            <div className="border-b border-[var(--landing-border)] px-3 py-2">
              <Skeleton className={`h-3.5 w-24 rounded ${S}`} />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-[var(--landing-border)] px-3 py-2 last:border-b-0"
              >
                <Skeleton className={`h-3.5 w-3.5 rounded ${S}`} />
                <Skeleton
                  className={`h-3 rounded ${S}`}
                  style={{ width: [80, 64, 96, 72, 88][i] }}
                />
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="dash-card glass-border overflow-hidden">
            <div className="border-b border-[var(--landing-border)] px-3 py-2">
              <Skeleton className={`h-3.5 w-20 rounded ${S}`} />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="space-y-1.5 border-b border-[var(--landing-border)] px-3 py-2 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className={`h-3 w-24 rounded ${S}`} />
                  <Skeleton className={`h-3 w-8 rounded ${S}`} />
                </div>
                <Skeleton className={`h-1.5 w-full rounded-full ${S}`} />
              </div>
            ))}
          </div>

          {/* Plan card */}
          <div className="dash-card glass-border space-y-2 p-3">
            <Skeleton className={`h-4 w-20 rounded-full ${S}`} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className={`h-3 w-16 rounded ${S}`} />
                <Skeleton className={`h-3 w-10 rounded ${S}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
