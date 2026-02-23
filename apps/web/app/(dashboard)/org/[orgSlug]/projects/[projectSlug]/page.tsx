import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  memories,
  organizationMembers,
  projectMembers,
  activityLogs,
  sessionLogs,
  memoryVersions,
  memoryLocks,
  auditLogs,
  users,
} from "@memctl/db/schema";
import { eq, and, desc, lt, or, sql } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { ProjectTabs } from "./project-tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, projectSlug } = await params;

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return { title: "Project" };

  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const { orgSlug, projectSlug } = await params;

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

  const isMember = member.role === "member";
  const isAdmin = !isMember;

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)),
    )
    .limit(1);

  if (!project) redirect(`/org/${orgSlug}`);

  // Check project-level access for members
  if (isMember) {
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

    if (!assignment) redirect(`/org/${orgSlug}`);
  }

  // Fetch memories, activity, sessions, and audit logs in parallel
  const [memoryList, activityList, sessionList, auditList] = await Promise.all([
    db
      .select()
      .from(memories)
      .where(eq(memories.projectId, project.id))
      .orderBy(desc(memories.updatedAt))
      .limit(500),
    db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.projectId, project.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50),
    db
      .select()
      .from(sessionLogs)
      .where(eq(sessionLogs.projectId, project.id))
      .orderBy(desc(sessionLogs.startedAt))
      .limit(20),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        targetUserId: auditLogs.targetUserId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(
        or(
          eq(auditLogs.projectId, project.id),
          and(eq(auditLogs.orgId, org.id), sql`${auditLogs.projectId} IS NULL`),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  ]);

  const activeCount = memoryList.filter((m) => !m.archivedAt).length;
  const archivedCount = memoryList.filter((m) => m.archivedAt).length;

  // MCP config without MEMCTL_TOKEN
  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        memctl: {
          command: "npx",
          args: ["memctl"],
          env: {
            MEMCTL_ORG: orgSlug,
            MEMCTL_PROJECT: projectSlug,
          },
        },
      },
    },
    null,
    2,
  );

  // Serialize memories for client component
  const serializedMemories = memoryList.map((m) => ({
    ...m,
    createdAt: m.createdAt?.toISOString() ?? "",
    updatedAt: m.updatedAt?.toISOString() ?? "",
    archivedAt: m.archivedAt?.toISOString() ?? null,
    expiresAt: m.expiresAt?.toISOString() ?? null,
    pinnedAt: m.pinnedAt?.toISOString() ?? null,
    lastAccessedAt: m.lastAccessedAt?.toISOString() ?? null,
  }));

  // Serialize activities
  const serializedActivities = activityList.map((a) => ({
    id: a.id,
    action: a.action,
    toolName: a.toolName,
    memoryKey: a.memoryKey,
    details: a.details,
    sessionId: a.sessionId,
    projectName: project.name,
    createdAt: a.createdAt?.toISOString() ?? "",
  }));

  // Serialize sessions
  const serializedSessions = sessionList.map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    branch: s.branch,
    summary: s.summary,
    keysRead: s.keysRead,
    keysWritten: s.keysWritten,
    toolsUsed: s.toolsUsed,
    startedAt: s.startedAt?.toISOString() ?? "",
    endedAt: s.endedAt?.toISOString() ?? null,
    projectName: project.name,
  }));

  // Build target user name map for audit logs
  const targetUserIds = [...new Set(auditList.map((a) => a.targetUserId).filter(Boolean))] as string[];
  const targetUserMap: Record<string, string> = {};
  if (targetUserIds.length > 0) {
    const targetUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.id} IN ${targetUserIds}`);
    for (const u of targetUsers) {
      targetUserMap[u.id] = u.name;
    }
  }

  // Serialize audit logs
  const serializedAuditLogs = auditList.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorName ?? "Unknown",
    targetUserName: a.targetUserId ? (targetUserMap[a.targetUserId] ?? "Unknown") : null,
    details: a.details,
    createdAt: a.createdAt?.toISOString() ?? "",
  }));

  // Activity stats
  const actionBreakdown: Record<string, number> = {};
  for (const a of serializedActivities) {
    actionBreakdown[a.action] = (actionBreakdown[a.action] ?? 0) + 1;
  }
  const activeSessions = serializedSessions.filter((s) => !s.endedAt).length;

  // Compute cursors for pagination
  const allActivityDates = [
    ...serializedActivities.map((a) => a.createdAt),
    ...serializedAuditLogs.map((a) => a.createdAt),
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const initialActivityCursor = allActivityDates.length > 0
    ? allActivityDates[allActivityDates.length - 1]
    : null;

  const initialSessionsCursor = serializedSessions.length > 0
    ? serializedSessions[serializedSessions.length - 1].startedAt
    : null;

  const activityApiPath = `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/activity`;
  const sessionsApiPath = `/api/v1/orgs/${orgSlug}/projects/${projectSlug}/activity/sessions`;

  // Hygiene data for this project
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nowMs = now.getTime();

  const activeMemories = memoryList.filter((m) => !m.archivedAt);
  const healthBuckets = { critical: 0, low: 0, medium: 0, healthy: 0 };
  const staleMemories: Array<{ key: string; project: string; lastAccessedAt: string | null; priority: number }> = [];
  const expiringMemories: Array<{ key: string; project: string; expiresAt: string }> = [];
  const weeklyGrowth: Record<string, number> = {};

  for (const m of activeMemories) {
    // Weekly growth
    if (m.createdAt) {
      const weekStart = new Date(m.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      weeklyGrowth[weekKey] = (weeklyGrowth[weekKey] ?? 0) + 1;
    }

    // Stale
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

    // Expiring
    if (m.expiresAt && new Date(m.expiresAt).getTime() <= sevenDaysFromNow.getTime() && new Date(m.expiresAt).getTime() > nowMs) {
      if (expiringMemories.length < 50) {
        expiringMemories.push({
          key: m.key,
          project: project.slug,
          expiresAt: new Date(m.expiresAt).toISOString(),
        });
      }
    }

    // Health score
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

  const growth = Object.entries(weeklyGrowth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, count]) => ({ week, count }));

  // Table sizes for this project
  const [versionCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memoryVersions)
    .where(sql`${memoryVersions.memoryId} IN (SELECT id FROM memories WHERE project_id = ${project.id})`);

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

  // Fetch org members with project assignment info (for Members tab)
  const orgMembers = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const serializedMembers = await Promise.all(
    orgMembers.map(async (m) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);

      const [assignment] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, m.userId),
          ),
        )
        .limit(1);

      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }
          : null,
        assignedToProject: !!assignment,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        badge="Project"
        title={project.name}
        description={project.description ?? undefined}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#F97316]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#F97316]">
            {activeCount} memories
          </span>
          {archivedCount > 0 && (
            <span className="rounded-md bg-[var(--landing-surface-2)] px-2.5 py-1 font-mono text-xs font-medium text-[var(--landing-text-tertiary)]">
              {archivedCount} archived
            </span>
          )}
        </div>
      </PageHeader>

      <ProjectTabs
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        projectId={project.id}
        isAdmin={isAdmin}
        currentUserId={session.user.id}
        memories={serializedMemories}
        mcpConfig={mcpConfig}
        activities={serializedActivities}
        auditLogs={serializedAuditLogs}
        sessions={serializedSessions}
        activityStats={{
          totalActions: serializedActivities.length,
          actionBreakdown,
          activeSessions,
          totalSessions: serializedSessions.length,
        }}
        activityApiPath={activityApiPath}
        sessionsApiPath={sessionsApiPath}
        initialActivityCursor={initialActivityCursor}
        initialSessionsCursor={initialSessionsCursor}
        hygieneData={{
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
        }}
        settingsData={{
          name: project.name,
          description: project.description,
          slug: project.slug,
          createdAt: project.createdAt?.toISOString() ?? "",
        }}
        membersData={serializedMembers}
      />
    </div>
  );
}
