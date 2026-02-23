import { Skeleton } from "@/components/ui/skeleton";

export function ActivitySkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--landing-border)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1.5">
          <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--landing-surface-2)]" />
          <Skeleton className="h-3 w-12 rounded bg-[var(--landing-surface-2)]" />
          <Skeleton className="h-3 w-24 rounded bg-[var(--landing-surface-2)]" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-3 w-16 rounded bg-[var(--landing-surface-2)]" />
            <Skeleton className="h-3 w-10 rounded bg-[var(--landing-surface-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
