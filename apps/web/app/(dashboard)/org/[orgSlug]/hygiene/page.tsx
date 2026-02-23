import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  memories,
  memoryVersions,
  activityLogs,
  memoryLocks,
} from "@memctl/db/schema";
import { eq, and, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { getOrgLimits, isUnlimited } from "@/lib/plans";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { HygieneDashboard } from "./hygiene-dashboard";

export const metadata: Metadata = { title: "Hygiene" };

export default async function HygienePage({
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
  const limits = getOrgLimits(org);
  const projectList = await db.select().from(projects).where(eq(projects.orgId, org.id));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nowMs = now.getTime();

  // Aggregate across all projects
  let totalMemories = 0;
  const staleMemories: Array<{ key: string; project: string; lastAccessedAt: string | null; priority: number }> = [];
  const expiringMemories: Array<{ key: string; project: string; expiresAt: string }> = [];
  const healthBuckets = { critical: 0, low: 0, medium: 0, healthy: 0 }; // 0-25, 25-50, 50-75, 75-100
  const weeklyGrowth: Record<string, number> = {};

  for (const project of projectList) {
    // All non-archived memories
    const allMems = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, project.id),
          isNull(memories.archivedAt),
        ),
      );

    totalMemories += allMems.length;

    for (const m of allMems) {
      // Memory growth by week
      if (m.createdAt) {
        const weekStart = new Date(m.createdAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().slice(0, 10);
        weeklyGrowth[weekKey] = (weeklyGrowth[weekKey] ?? 0) + 1;
      }

      // Stale: not accessed in 30+ days, not pinned
      const lastAccess = m.lastAccessedAt ? new Date(m.lastAccessedAt).getTime() : 0;
      if (!m.pinnedAt && (!lastAccess || lastAccess < thirtyDaysAgo.getTime())) {
        if (staleMemories.length < 50) {
          staleMemories.push({
            key: m.key,
            project: project.slug,
            lastAccessedAt: m.lastAccessedAt ? new Date(m.lastAccessedAt).toISOString() : null,
            priority: m.priority ?? 0,
          });
        }
      }

      // Expiring soon: within 7 days
      if (m.expiresAt && new Date(m.expiresAt).getTime() <= sevenDaysFromNow.getTime() && new Date(m.expiresAt).getTime() > nowMs) {
        if (expiringMemories.length < 50) {
          expiringMemories.push({
            key: m.key,
            project: project.slug,
            expiresAt: new Date(m.expiresAt).toISOString(),
          });
        }
      }

      // Health score distribution
      const ageDays = m.createdAt ? (nowMs - m.createdAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
      const daysSinceAccess = m.lastAccessedAt
        ? (nowMs - new Date(m.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;
      const accessCount = m.accessCount ?? 0;
      const helpfulCount = m.helpfulCount ?? 0;
      const unhelpfulCount = m.unhelpfulCount ?? 0;

      const ageFactor = Math.max(0, 25 - ageDays / 14);
      const accessFactor = Math.min(25, accessCount * 2.5);
      const feedbackFactor = 12.5 + Math.min(12.5, Math.max(-12.5, (helpfulCount - unhelpfulCount) * 2.5));
      const freshnessFactor = daysSinceAccess === Infinity ? 0 : Math.max(0, 25 - daysSinceAccess / 7);
      const healthScore = ageFactor + accessFactor + feedbackFactor + freshnessFactor;

      if (healthScore < 25) healthBuckets.critical++;
      else if (healthScore < 50) healthBuckets.low++;
      else if (healthScore < 75) healthBuckets.medium++;
      else healthBuckets.healthy++;
    }
  }

  // Sort weekly growth by date
  const growth = Object.entries(weeklyGrowth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, count]) => ({ week, count }));

  // Query table sizes across all org projects
  const projectIds = projectList.map((p) => p.id);
  let tableSizes = { versions: 0, activityLogs: 0, expiredLocks: 0 };
  if (projectIds.length > 0) {
    const [versionCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(memoryVersions)
      .where(sql`${memoryVersions.memoryId} IN (SELECT id FROM memories WHERE project_id IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)}))`);

    const [activityCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(activityLogs)
      .where(sql`${activityLogs.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`);

    const [lockCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(memoryLocks)
      .where(
        and(
          sql`${memoryLocks.projectId} IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)})`,
          lt(memoryLocks.expiresAt, new Date()),
        ),
      );

    tableSizes = {
      versions: versionCount?.count ?? 0,
      activityLogs: activityCount?.count ?? 0,
      expiredLocks: lockCount?.count ?? 0,
    };
  }

  const memoryLimit = limits.memoryLimitOrg;
  const usagePercent = isUnlimited(memoryLimit) ? 0 : Math.round((totalMemories / memoryLimit) * 100);

  return (
    <div>
      <PageHeader title="Memory Hygiene" description="Memory health analysis and cleanup tools" />

      <HygieneDashboard
        healthBuckets={healthBuckets}
        staleMemories={staleMemories}
        expiringMemories={expiringMemories}
        growth={growth}
        capacity={{
          used: totalMemories,
          limit: isUnlimited(memoryLimit) ? null : memoryLimit,
          usagePercent,
        }}
        orgSlug={orgSlug}
        tableSizes={tableSizes}
      />
    </div>
  );
}
