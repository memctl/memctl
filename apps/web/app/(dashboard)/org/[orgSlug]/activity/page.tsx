import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Activity" };

import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  activityLogs,
  sessionLogs,
  auditLogs,
  users,
} from "@memctl/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { ActivityFeed } from "./activity-feed";

export default async function ActivityPage({
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

  // Get accessible project IDs (members only see assigned projects)
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));
  let accessibleProjectIds: string[];

  if (member.role === "member") {
    const assignments = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, session.user.id),
          inArray(
            projectMembers.projectId,
            projectList.map((p) => p.id),
          ),
        ),
      );
    accessibleProjectIds = assignments.map((a) => a.projectId);
  } else {
    accessibleProjectIds = projectList.map((p) => p.id);
  }

  // Build project name map
  const projectNameMap: Record<string, string> = {};
  for (const p of projectList) projectNameMap[p.id] = p.name;

  // Batch queries instead of per-project loop
  const [activityList, sessionList, auditList] = await Promise.all([
    accessibleProjectIds.length > 0
      ? db
          .select({
            id: activityLogs.id,
            action: activityLogs.action,
            toolName: activityLogs.toolName,
            memoryKey: activityLogs.memoryKey,
            details: activityLogs.details,
            sessionId: activityLogs.sessionId,
            projectId: activityLogs.projectId,
            createdAt: activityLogs.createdAt,
            createdByName: users.name,
          })
          .from(activityLogs)
          .leftJoin(users, eq(activityLogs.createdBy, users.id))
          .where(inArray(activityLogs.projectId, accessibleProjectIds))
          .orderBy(desc(activityLogs.createdAt))
          .limit(50)
      : Promise.resolve([]),
    accessibleProjectIds.length > 0
      ? db
          .select()
          .from(sessionLogs)
          .where(inArray(sessionLogs.projectId, accessibleProjectIds))
          .orderBy(desc(sessionLogs.startedAt))
          .limit(20)
      : Promise.resolve([]),
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
      .where(eq(auditLogs.orgId, org.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  ]);

  const serializedActivities = activityList.map((a) => ({
    id: a.id,
    action: a.action,
    toolName: a.toolName,
    memoryKey: a.memoryKey,
    details: a.details,
    sessionId: a.sessionId,
    projectName: projectNameMap[a.projectId] ?? "Unknown",
    createdByName: a.createdByName ?? null,
    createdAt: a.createdAt?.toISOString() ?? "",
  }));

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
    projectName: projectNameMap[s.projectId] ?? "Unknown",
  }));

  // Resolve target user names for audit logs
  const targetUserIds = [
    ...new Set(auditList.map((a) => a.targetUserId).filter(Boolean)),
  ] as string[];
  const targetUserMap: Record<string, string> = {};
  if (targetUserIds.length > 0) {
    const targetUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, targetUserIds));
    for (const u of targetUsers) targetUserMap[u.id] = u.name;
  }

  const serializedAuditLogs = auditList.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actorName ?? "Unknown",
    targetUserName: a.targetUserId
      ? (targetUserMap[a.targetUserId] ?? "Unknown")
      : null,
    details: a.details,
    createdAt: a.createdAt?.toISOString() ?? "",
  }));

  // Compute stats
  const actionBreakdown: Record<string, number> = {};
  for (const a of serializedActivities) {
    actionBreakdown[a.action] = (actionBreakdown[a.action] ?? 0) + 1;
  }
  const activeSessions = serializedSessions.filter((s) => !s.endedAt).length;

  // Compute cursors
  const allActivityDates = [
    ...serializedActivities.map((a) => a.createdAt),
    ...serializedAuditLogs.map((a) => a.createdAt),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const initialActivityCursor =
    allActivityDates.length > 0
      ? allActivityDates[allActivityDates.length - 1]
      : null;

  const initialSessionsCursor =
    serializedSessions.length > 0
      ? serializedSessions[serializedSessions.length - 1].startedAt
      : null;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-[var(--landing-text)]">
        Activity & Sessions
      </h1>

      <ActivityFeed
        activities={serializedActivities}
        auditLogs={serializedAuditLogs}
        sessions={serializedSessions}
        stats={{
          totalActions: serializedActivities.length,
          actionBreakdown,
          activeSessions,
          totalSessions: serializedSessions.length,
        }}
        apiPath={`/api/v1/orgs/${orgSlug}/activity`}
        sessionsApiPath={`/api/v1/orgs/${orgSlug}/activity/sessions`}
        initialCursor={initialActivityCursor}
        initialSessionsCursor={initialSessionsCursor}
      />
    </div>
  );
}
