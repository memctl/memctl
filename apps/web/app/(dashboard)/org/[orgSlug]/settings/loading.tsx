import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  FormFieldSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton hasDescription />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="dash-card glass-border space-y-5 p-5">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
            <Skeleton className={`h-9 w-24 rounded ${S}`} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:col-span-2">
          {/* Plan card */}
          <div className="dash-card glass-border space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className={`h-5 w-16 rounded-full ${S}`} />
              <Skeleton className={`h-3 w-20 rounded ${S}`} />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <Skeleton className={`h-3 w-16 rounded ${S}`} />
                  <Skeleton className={`h-3 w-12 rounded ${S}`} />
                </div>
                <Skeleton className={`h-1.5 w-full rounded-full ${S}`} />
              </div>
            ))}
            <Skeleton className={`h-3 w-28 rounded ${S}`} />
          </div>

          {/* Support card */}
          <div className="dash-card glass-border space-y-2 p-4">
            <Skeleton className={`h-3.5 w-32 rounded ${S}`} />
            <Skeleton className={`h-3 w-full rounded ${S}`} />
            <Skeleton className={`h-3 w-3/4 rounded ${S}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
