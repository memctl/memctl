import {
  PageHeaderSkeleton,
  StatCardGrid,
  ChartSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

export default function UsageLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription />

      {/* Usage cards */}
      <div className="mb-4">
        <StatCardGrid count={6} cols="sm:grid-cols-2 lg:grid-cols-3" />
      </div>

      {/* Charts - 2 column */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartSkeleton height={220} />
        <ChartSkeleton height={220} />
      </div>

      {/* Bottom charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton height={180} />
        <ChartSkeleton height={180} />
      </div>
    </div>
  );
}
