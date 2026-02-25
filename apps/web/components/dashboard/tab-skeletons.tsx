import { Skeleton } from "@/components/ui/skeleton";

export function MemoriesSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {/* Filter bar */}
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-7 w-48 rounded bg-[var(--landing-surface-2)]" />
        <Skeleton className="h-7 w-20 rounded bg-[var(--landing-surface-2)]" />
        <Skeleton className="h-7 w-20 rounded bg-[var(--landing-surface-2)]" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-[var(--landing-border)]">
        {Array.from({ length: rows }).map((_, i) => {
          const keyWidth = [110, 80, 140, 96, 120][i % 5];
          const valWidth = [200, 160, 240, 180, 220][i % 5];
          const showTags = i % 3 === 0;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2"
              style={{ opacity: 1 - i * 0.05 }}
            >
              {/* Priority dot */}
              <Skeleton className="h-2 w-2 shrink-0 rounded-full bg-[var(--landing-surface-2)]" />
              {/* Key */}
              <Skeleton
                className="h-3 rounded bg-[var(--landing-surface-2)]"
                style={{ width: keyWidth }}
              />
              {/* Value */}
              <Skeleton
                className="h-3 rounded bg-[var(--landing-surface-2)]"
                style={{ width: valWidth }}
              />
              {showTags && (
                <Skeleton className="h-4 w-12 rounded-full bg-[var(--landing-surface-2)]" />
              )}
              <div className="ml-auto">
                <Skeleton className="h-3 w-14 rounded bg-[var(--landing-surface-2)]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GraphSkeleton() {
  return (
    <div className="dash-card flex h-[500px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32">
          {/* Node circles */}
          {[
            { x: 48, y: 12, r: 10 },
            { x: 88, y: 36, r: 8 },
            { x: 16, y: 44, r: 12 },
            { x: 72, y: 76, r: 9 },
            { x: 32, y: 84, r: 11 },
            { x: 56, y: 56, r: 7 },
          ].map((n, i) => (
            <Skeleton
              key={i}
              className="absolute rounded-full bg-[var(--landing-surface-2)]"
              style={{
                left: n.x,
                top: n.y,
                width: n.r * 2,
                height: n.r * 2,
                opacity: 0.6 - i * 0.06,
              }}
            />
          ))}
        </div>
        <Skeleton className="h-3 w-24 rounded bg-[var(--landing-surface-2)]" />
      </div>
    </div>
  );
}

export function MembersSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2"
          style={{ opacity: 1 - i * 0.08 }}
        >
          {/* Avatar */}
          <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-[var(--landing-surface-2)]" />
          {/* Name */}
          <Skeleton
            className="h-3 rounded bg-[var(--landing-surface-2)]"
            style={{ width: [100, 80, 120, 90, 110, 95][i % 6] }}
          />
          {/* Role badge */}
          <Skeleton className="h-4 w-14 rounded-full bg-[var(--landing-surface-2)]" />
          <div className="ml-auto">
            <Skeleton className="h-3 w-16 rounded bg-[var(--landing-surface-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CleanupSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dash-card space-y-2 p-3">
            <Skeleton className="h-3 w-16 rounded bg-[var(--landing-surface-2)]" />
            <Skeleton className="h-5 w-10 rounded bg-[var(--landing-surface-2)]" />
          </div>
        ))}
      </div>
      {/* List rows */}
      <div className="divide-y divide-[var(--landing-border)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <Skeleton className="h-3 w-24 rounded bg-[var(--landing-surface-2)]" />
            <Skeleton className="h-3 w-16 rounded bg-[var(--landing-surface-2)]" />
            <div className="ml-auto">
              <Skeleton className="h-3 w-12 rounded bg-[var(--landing-surface-2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-lg space-y-6">
      {/* Form fields */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20 rounded bg-[var(--landing-surface-2)]" />
          <Skeleton className="h-8 w-full rounded bg-[var(--landing-surface-2)]" />
        </div>
      ))}
      {/* Button */}
      <Skeleton className="h-8 w-24 rounded bg-[var(--landing-surface-2)]" />
    </div>
  );
}
