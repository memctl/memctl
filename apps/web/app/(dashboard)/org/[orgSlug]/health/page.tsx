import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Health" };

import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  memories,
  memoryLocks,
  webhookConfigs,
  sessionLogs,
  activityLogs,
} from "@memctl/db/schema";
import { eq, and, count, desc, isNull, isNotNull } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { HealthDashboard } from "./health-dashboard";

export default async function HealthPage({
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

  // Aggregate stats across all projects
  let totalMemories = 0;
  const totalVersions = 0;
  let totalPinned = 0;
  let totalArchived = 0;
  let totalExpiring = 0;
  let totalSessions = 0;
  let totalActivities = 0;
  let totalWebhooks = 0;
  let totalActiveLocks = 0;

  const projectStats: Array<{
    name: string;
    slug: string;
    memoryCount: number;
    pinnedCount: number;
    archivedCount: number;
    sessionCount: number;
    activityCount: number;
  }> = [];

  // Priority distribution
  const priorityBuckets = { high: 0, medium: 0, low: 0, none: 0 };
  // Tag frequency
  const tagCounts: Record<string, number> = {};

  for (const project of projectList) {
    const [memCount] = await db.select({ value: count() }).from(memories).where(eq(memories.projectId, project.id));
    const mc = memCount?.value ?? 0;
    totalMemories += mc;

    const [pinCount] = await db.select({ value: count() }).from(memories).where(and(eq(memories.projectId, project.id), isNotNull(memories.pinnedAt)));
    const pc = pinCount?.value ?? 0;
    totalPinned += pc;

    const [archCount] = await db.select({ value: count() }).from(memories).where(and(eq(memories.projectId, project.id), isNotNull(memories.archivedAt)));
    const ac = archCount?.value ?? 0;
    totalArchived += ac;

    const [expCount] = await db.select({ value: count() }).from(memories).where(and(eq(memories.projectId, project.id), isNotNull(memories.expiresAt)));
    totalExpiring += expCount?.value ?? 0;

    const [sessCount] = await db.select({ value: count() }).from(sessionLogs).where(eq(sessionLogs.projectId, project.id));
    const sc = sessCount?.value ?? 0;
    totalSessions += sc;

    const [actCount] = await db.select({ value: count() }).from(activityLogs).where(eq(activityLogs.projectId, project.id));
    const atc = actCount?.value ?? 0;
    totalActivities += atc;

    const hooks = await db.select().from(webhookConfigs).where(eq(webhookConfigs.projectId, project.id));
    totalWebhooks += hooks.length;

    const [lockCount] = await db.select({ value: count() }).from(memoryLocks).where(eq(memoryLocks.projectId, project.id));
    totalActiveLocks += lockCount?.value ?? 0;

    // Per-project priority stats
    const allMems = await db.select({ priority: memories.priority, tags: memories.tags }).from(memories).where(eq(memories.projectId, project.id));
    for (const m of allMems) {
      const p = m.priority ?? 0;
      if (p >= 70) priorityBuckets.high++;
      else if (p >= 30) priorityBuckets.medium++;
      else if (p > 0) priorityBuckets.low++;
      else priorityBuckets.none++;

      if (m.tags) {
        try {
          const tags = JSON.parse(m.tags);
          if (Array.isArray(tags)) {
            for (const t of tags) {
              tagCounts[t] = (tagCounts[t] ?? 0) + 1;
            }
          }
        } catch { /* skip */ }
      }
    }

    projectStats.push({
      name: project.name,
      slug: project.slug,
      memoryCount: mc,
      pinnedCount: pc,
      archivedCount: ac,
      sessionCount: sc,
      activityCount: atc,
    });
  }

  // Top tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  const memoryLimit = currentPlan.memoryLimitOrg;
  const usagePercent = memoryLimit === Infinity ? 0 : Math.round((totalMemories / memoryLimit) * 100);

  const checks = [
    { name: "Database", status: "pass" as const, detail: "Connected" },
    { name: "Memory Usage", status: usagePercent >= 95 ? "fail" as const : usagePercent >= 80 ? "warn" as const : "pass" as const, detail: `${usagePercent}% (${totalMemories}/${memoryLimit === Infinity ? "∞" : memoryLimit})` },
    { name: "Active Locks", status: totalActiveLocks > 10 ? "warn" as const : "pass" as const, detail: `${totalActiveLocks} lock(s)` },
    { name: "Projects", status: "pass" as const, detail: `${projectList.length} project(s)` },
    { name: "Plan", status: "pass" as const, detail: currentPlan.name },
  ];

  return (
    <div>
      <PageHeader title="System Health" description="Organization-wide diagnostics and memory analytics" />

      <HealthDashboard
        checks={checks}
        stats={{
          totalMemories,
          totalVersions,
          totalPinned,
          totalArchived,
          totalExpiring,
          totalSessions,
          totalActivities,
          totalWebhooks,
          totalActiveLocks,
          memoryLimit: memoryLimit === Infinity ? null : memoryLimit,
          usagePercent,
        }}
        priorityBuckets={priorityBuckets}
        topTags={topTags}
        projectStats={projectStats}
        planName={currentPlan.name}
        orgSlug={orgSlug}
      />
    </div>
  );
}
