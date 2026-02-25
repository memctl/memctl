import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  FormFieldSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function NewProjectLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeaderSkeleton hasDescription />

      {/* Step indicator */}
      <div className="dash-card glass-border mb-6 p-4">
        <div className="flex items-center justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className={`h-8 w-8 shrink-0 rounded-full ${S}`} />
              <Skeleton className={`hidden h-3 w-20 rounded sm:block ${S}`} />
              {i < 3 && (
                <Skeleton className={`mx-2 hidden h-px w-12 sm:block ${S}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="dash-card glass-border space-y-5 p-6">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-24 rounded ${S}`} />
              <Skeleton className={`h-20 w-full rounded ${S}`} />
            </div>
            <Skeleton className={`h-10 w-full rounded ${S}`} />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4 lg:col-span-2">
          <div className="dash-card glass-border space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className={`h-3.5 w-24 rounded ${S}`} />
              <Skeleton className={`h-4 w-28 rounded-full ${S}`} />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-3 rounded ${S}`}
                style={{ width: `${50 + Math.random() * 50}%` }}
              />
            ))}
          </div>

          <div className="dash-card glass-border space-y-3 p-4">
            <Skeleton className={`h-3.5 w-28 rounded ${S}`} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className={`mt-0.5 h-4 w-4 shrink-0 rounded ${S}`} />
                <div className="space-y-1">
                  <Skeleton className={`h-3 w-20 rounded ${S}`} />
                  <Skeleton className={`h-2.5 w-36 rounded ${S}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
