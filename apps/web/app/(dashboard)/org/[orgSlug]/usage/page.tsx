import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Usage" };
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  apiTokens,
  sessionLogs,
  activityLogs,
} from "@memctl/db/schema";
import { eq, and, count, isNull, inArray, gte } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { getOrgLimits, isUnlimited as isUnlimitedValue } from "@/lib/plans";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { Progress } from "@/components/ui/progress";
import { UsageCharts } from "./usage-charts";

export default async function UsagePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!member) redirect("/");

  const currentPlan = PLANS[org.planId as PlanId] ?? PLANS.free;
  const limits = getOrgLimits(org);
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  const [memberCount] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));
  const [activeTokenCount] = await db
    .select({ value: count() })
    .from(apiTokens)
    .where(and(eq(apiTokens.orgId, org.id), isNull(apiTokens.revokedAt)));

  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - 29);

  const toDateKey = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const trendBuckets = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(date.getDate() + index);
    return {
      key: toDateKey(date),
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      writes: 0,
      deletes: 0,
      other: 0,
    };
  });

  const trendByDay = new Map(
    trendBuckets.map((bucket) => [bucket.key, bucket]),
  );

  if (projectList.length > 0) {
    const recentActivity = await db
      .select({
        action: activityLogs.action,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .where(
        and(
          inArray(
            activityLogs.projectId,
            projectList.map((project) => project.id),
          ),
          gte(activityLogs.createdAt, trendStart),
        ),
      );

    for (const log of recentActivity) {
      const key = toDateKey(log.createdAt);
      const bucket = trendByDay.get(key);
      if (!bucket) continue;

      if (log.action === "memory_write") {
        bucket.writes += 1;
      } else if (log.action === "memory_delete") {
        bucket.deletes += 1;
      } else {
        bucket.other += 1;
      }
    }
  }

  const activityTrendData = trendBuckets.map(
    ({ date, writes, deletes, other }) => ({
      date,
      writes,
      deletes,
      other,
    }),
  );

  let totalMemories = 0;
  let totalSessions = 0;
  let totalActivities = 0;
  const memoryByProject: { name: string; count: number }[] = [];
  const priorityDistribution = { high: 0, medium: 0, low: 0, none: 0 };
  const tagCounts: Record<string, number> = {};

  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    const memCount = result?.value ?? 0;
    totalMemories += memCount;
    memoryByProject.push({ name: project.name, count: memCount });

    const [sessCount] = await db
      .select({ value: count() })
      .from(sessionLogs)
      .where(eq(sessionLogs.projectId, project.id));
    totalSessions += sessCount?.value ?? 0;

    const [actCount] = await db
      .select({ value: count() })
      .from(activityLogs)
      .where(eq(activityLogs.projectId, project.id));
    totalActivities += actCount?.value ?? 0;

    // Priority and tag aggregation
    const allMems = await db
      .select({ priority: memories.priority, tags: memories.tags })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    for (const m of allMems) {
      const p = m.priority ?? 0;
      if (p >= 70) priorityDistribution.high++;
      else if (p >= 30) priorityDistribution.medium++;
      else if (p > 0) priorityDistribution.low++;
      else priorityDistribution.none++;

      if (m.tags) {
        try {
          const tags = JSON.parse(m.tags);
          if (Array.isArray(tags)) {
            for (const t of tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  const tagBreakdown = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  const usageItems = [
    {
      label: "Projects",
      current: projectList.length,
      limit: limits.projectLimit,
    },
    {
      label: "Members",
      current: memberCount?.value ?? 0,
      limit: limits.memberLimit,
    },
    { label: "Memories", current: totalMemories, limit: limits.memoryLimitOrg },
    {
      label: "API Tokens",
      current: activeTokenCount?.value ?? 0,
      limit: 999999,
    },
    { label: "Sessions", current: totalSessions, limit: 999999 },
    { label: "Activity Logs", current: totalActivities, limit: 999999 },
  ];

  return (
    <div>
      <PageHeader
        title="Usage & Analytics"
        description={`${currentPlan.name} plan`}
      />

      {/* Plan Usage - 3 columns for density */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {usageItems.map((item) => {
          const unlimited = isUnlimitedValue(item.limit);
          const percentage = unlimited
            ? 0
            : Math.min((item.current / item.limit) * 100, 100);

          return (
            <div
              key={item.label}
              className="dash-card glass-border relative p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">
                  {item.label}
                </span>
                <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {item.current.toLocaleString()} /{" "}
                  {unlimited ? "∞" : item.limit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={unlimited ? 0 : percentage}
                className={`h-1.5 bg-[var(--landing-surface-2)] ${
                  percentage >= 90
                    ? "[&>div]:bg-red-500"
                    : percentage >= 70
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-[#F97316]"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <UsageCharts
        memoryByProject={memoryByProject}
        activityTrendData={activityTrendData}
        priorityDistribution={priorityDistribution}
        tagBreakdown={tagBreakdown}
      />
    </div>
  );
}
