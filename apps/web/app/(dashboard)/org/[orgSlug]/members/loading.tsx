import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  StatCardGrid,
} from "@/components/dashboard/shared/skeleton-primitives";

const S = "bg-[var(--landing-surface-2)]";

export default function MembersLoading() {
  return (
    <div>
      <PageHeaderSkeleton hasDescription hasActions />

      {/* Stat cards */}
      <div className="mb-4">
        <StatCardGrid count={4} cols="sm:grid-cols-2 md:grid-cols-4" />
      </div>

      {/* Members table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--landing-border)]">
              {["Member", "Email", "Role", "Projects", "Joined"].map((_, i) => (
                <th key={i} className="px-3 py-2 text-left">
                  <Skeleton
                    className={`h-3 rounded ${S}`}
                    style={{ width: [80, 100, 60, 70, 60][i] }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, ri) => (
              <tr
                key={ri}
                className="border-b border-[var(--landing-border)]"
                style={{ opacity: 1 - ri * 0.1 }}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Skeleton
                      className={`h-7 w-7 shrink-0 rounded-full ${S}`}
                    />
                    <Skeleton
                      className={`h-3 rounded ${S}`}
                      style={{ width: [100, 80, 120, 90, 110][ri] }}
                    />
                  </div>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <Skeleton className={`h-3 w-32 rounded ${S}`} />
                </td>
                <td className="px-3 py-2">
                  <Skeleton className={`h-5 w-14 rounded-full ${S}`} />
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <Skeleton className={`h-3 w-6 rounded ${S}`} />
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  <Skeleton className={`h-3 w-16 rounded ${S}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
