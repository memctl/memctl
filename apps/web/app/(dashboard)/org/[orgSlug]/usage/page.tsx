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
import { eq, and, count, isNull, isNotNull } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
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

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) redirect("/");

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, session.user.id)))
    .limit(1);
  if (!member) redirect("/");

  const currentPlan = PLANS[org.planId as PlanId] ?? PLANS.free;
  const projectList = await db.select().from(projects).where(eq(projects.orgId, org.id));

  const [memberCount] = await db.select({ value: count() }).from(organizationMembers).where(eq(organizationMembers.orgId, org.id));
  const [tokenCount] = await db.select({ value: count() }).from(apiTokens).where(and(eq(apiTokens.orgId, org.id), isNull(apiTokens.revokedAt)));

  let totalMemories = 0;
  let totalSessions = 0;
  let totalActivities = 0;
  const memoryByProject: { name: string; count: number }[] = [];
  const priorityDistribution = { high: 0, medium: 0, low: 0, none: 0 };
  const tagCounts: Record<string, number> = {};

  for (const project of projectList) {
    const [result] = await db.select({ value: count() }).from(memories).where(eq(memories.projectId, project.id));
    const memCount = result?.value ?? 0;
    totalMemories += memCount;
    memoryByProject.push({ name: project.name, count: memCount });

    const [sessCount] = await db.select({ value: count() }).from(sessionLogs).where(eq(sessionLogs.projectId, project.id));
    totalSessions += sessCount?.value ?? 0;

    const [actCount] = await db.select({ value: count() }).from(activityLogs).where(eq(activityLogs.projectId, project.id));
    totalActivities += actCount?.value ?? 0;

    // Priority and tag aggregation
    const allMems = await db.select({ priority: memories.priority, tags: memories.tags }).from(memories).where(eq(memories.projectId, project.id));
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
        } catch { /* skip */ }
      }
    }
  }

  const tagBreakdown = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  const usageItems = [
    { label: "Projects", current: projectList.length, limit: currentPlan.projectLimit },
    { label: "Members", current: memberCount?.value ?? 0, limit: currentPlan.memberLimit },
    { label: "Memories", current: totalMemories, limit: currentPlan.memoryLimitOrg },
    { label: "API Calls", current: 0, limit: currentPlan.apiCallLimit },
    { label: "Sessions", current: totalSessions, limit: Infinity },
    { label: "Activity Logs", current: totalActivities, limit: Infinity },
  ];

  return (
    <div>
      <PageHeader title="Usage & Analytics" description={`${currentPlan.name} plan`} />

      {/* Plan Usage - 3 columns for density */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {usageItems.map((item) => {
          const isUnlimited = item.limit === Infinity;
          const percentage = isUnlimited ? 0 : Math.min((item.current / item.limit) * 100, 100);

          return (
            <div key={item.label} className="dash-card glass-border relative p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium text-[var(--landing-text)]">{item.label}</span>
                <span className="font-mono text-[10px] text-[var(--landing-text-tertiary)]">
                  {item.current.toLocaleString()} / {isUnlimited ? "∞" : item.limit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={isUnlimited ? 0 : percentage}
                className={`h-1.5 bg-[var(--landing-surface-2)] ${
                  percentage >= 90 ? "[&>div]:bg-red-500" : percentage >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-[#F97316]"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <UsageCharts
        memoryByProject={memoryByProject}
        priorityDistribution={priorityDistribution}
        tagBreakdown={tagBreakdown}
      />
    </div>
  );
}
