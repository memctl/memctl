import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  memories,
  memoryVersions,
  activityLogs,
  memoryLocks,
} from "@memctl/db/schema";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectSlug: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug, projectSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (member.role === "member") {
    const [assignment] = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!assignment)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const memoryList = await db
    .select()
    .from(memories)
    .where(eq(memories.projectId, project.id))
    .orderBy(desc(memories.updatedAt))
    .limit(500);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nowMs = now.getTime();

  const activeMemories = memoryList.filter((m) => !m.archivedAt);
  const healthBuckets = { critical: 0, low: 0, medium: 0, healthy: 0 };
  const staleMemories: Array<{
    key: string;
    project: string;
    lastAccessedAt: string | null;
    priority: number;
  }> = [];
  const expiringMemories: Array<{
    key: string;
    project: string;
    expiresAt: string;
  }> = [];
  const weeklyGrowth: Record<string, number> = {};

  for (const m of activeMemories) {
    if (m.createdAt) {
      const weekStart = new Date(m.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      weeklyGrowth[weekKey] = (weeklyGrowth[weekKey] ?? 0) + 1;
    }

    const lastAccess = m.lastAccessedAt
      ? new Date(m.lastAccessedAt).getTime()
      : 0;
    if (!m.pinnedAt && (!lastAccess || lastAccess < thirtyDaysAgo.getTime())) {
      if (staleMemories.length < 50) {
        staleMemories.push({
          key: m.key,
          project: project.slug,
          lastAccessedAt: m.lastAccessedAt
            ? new Date(m.lastAccessedAt).toISOString()
            : null,
          priority: m.priority ?? 0,
        });
      }
    }

    if (
      m.expiresAt &&
      new Date(m.expiresAt).getTime() <= sevenDaysFromNow.getTime() &&
      new Date(m.expiresAt).getTime() > nowMs
    ) {
      if (expiringMemories.length < 50) {
        expiringMemories.push({
          key: m.key,
          project: project.slug,
          expiresAt: new Date(m.expiresAt).toISOString(),
        });
      }
    }

    const ageDays = m.createdAt
      ? (nowMs - m.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const daysSinceAccess = m.lastAccessedAt
      ? (nowMs - new Date(m.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    const accessCount = m.accessCount ?? 0;
    const helpfulCount = m.helpfulCount ?? 0;
    const unhelpfulCount = m.unhelpfulCount ?? 0;

    const ageFactor = Math.max(0, 25 - ageDays / 14);
    const accessFactor = Math.min(25, accessCount * 2.5);
    const feedbackFactor =
      12.5 +
      Math.min(12.5, Math.max(-12.5, (helpfulCount - unhelpfulCount) * 2.5));
    const freshnessFactor =
      daysSinceAccess === Infinity ? 0 : Math.max(0, 25 - daysSinceAccess / 7);
    const healthScore =
      ageFactor + accessFactor + feedbackFactor + freshnessFactor;

    if (healthScore < 25) healthBuckets.critical++;
    else if (healthScore < 50) healthBuckets.low++;
    else if (healthScore < 75) healthBuckets.medium++;
    else healthBuckets.healthy++;
  }

  const growth = Object.entries(weeklyGrowth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, count]) => ({ week, count }));

  const [versionCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memoryVersions)
    .where(
      sql`${memoryVersions.memoryId} IN (SELECT id FROM memories WHERE project_id = ${project.id})`,
    );

  const [activityCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(activityLogs)
    .where(eq(activityLogs.projectId, project.id));

  const [lockCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memoryLocks)
    .where(
      and(
        eq(memoryLocks.projectId, project.id),
        lt(memoryLocks.expiresAt, new Date()),
      ),
    );

  const tableSizes = {
    versions: versionCount?.count ?? 0,
    activityLogs: activityCount?.count ?? 0,
    expiredLocks: lockCount?.count ?? 0,
  };

  return NextResponse.json({
    result: {
      healthBuckets,
      staleMemories,
      expiringMemories,
      growth,
      capacity: {
        used: activeMemories.length,
        limit: null,
        usagePercent: 0,
      },
      tableSizes,
    },
  });
}
