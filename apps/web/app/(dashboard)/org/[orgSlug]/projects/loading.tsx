import {
  PageHeaderSkeleton,
  ProjectCardSkeleton,
} from "@/components/dashboard/shared/skeleton-primitives";

export default function ProjectsLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription hasActions />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ opacity: 1 - i * 0.1 }}>
            <ProjectCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
