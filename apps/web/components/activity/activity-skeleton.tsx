import { Skeleton } from "@/components/ui/skeleton";

export function ActivitySkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--landing-border)]">
      {Array.from({ length: rows }).map((_, i) => {
        // Vary widths for a more natural look
        const keyWidth = [96, 72, 120, 84, 108][i % 5];
        const showKey = i % 3 !== 2;
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ opacity: 1 - i * 0.06 }}
          >
            <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--landing-surface-2)]" />
            <Skeleton className="h-3 w-10 rounded bg-[var(--landing-surface-2)]" />
            {showKey && (
              <Skeleton
                className="h-3 rounded bg-[var(--landing-surface-2)]"
                style={{ width: keyWidth }}
              />
            )}
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-3 w-14 rounded bg-[var(--landing-surface-2)]" />
              <Skeleton className="h-3 w-8 rounded bg-[var(--landing-surface-2)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
