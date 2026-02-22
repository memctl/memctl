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
  activityLogs,
  sessionLogs,
  memories,
} from "@memctl/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { ActivityFeed } from "./activity-feed";

export default async function ActivityPage({
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

  // Get all org projects
  const projectList = await db.select().from(projects).where(eq(projects.orgId, org.id));

  // Fetch activity and session logs across all projects
  const allActivities: Array<{
    id: string;
    action: string;
    toolName: string | null;
    memoryKey: string | null;
    details: string | null;
    sessionId: string | null;
    projectName: string;
    createdAt: string;
  }> = [];

  const allSessions: Array<{
    id: string;
    sessionId: string;
    branch: string | null;
    summary: string | null;
    keysRead: string | null;
    keysWritten: string | null;
    toolsUsed: string | null;
    startedAt: string;
    endedAt: string | null;
    projectName: string;
  }> = [];

  for (const project of projectList) {
    const activities = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.projectId, project.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(100);

    for (const a of activities) {
      allActivities.push({
        id: a.id,
        action: a.action,
        toolName: a.toolName,
        memoryKey: a.memoryKey,
        details: a.details,
        sessionId: a.sessionId,
        projectName: project.name,
        createdAt: a.createdAt?.toISOString() ?? "",
      });
    }

    const sessions = await db
      .select()
      .from(sessionLogs)
      .where(eq(sessionLogs.projectId, project.id))
      .orderBy(desc(sessionLogs.startedAt))
      .limit(50);

    for (const s of sessions) {
      allSessions.push({
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
      });
    }
  }

  // Sort activities by time descending
  allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  allActivities.splice(200);

  // Sort sessions by start time descending
  allSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  allSessions.splice(50);

  // Compute stats
  const totalActions = allActivities.length;
  const actionBreakdown: Record<string, number> = {};
  for (const a of allActivities) {
    actionBreakdown[a.action] = (actionBreakdown[a.action] ?? 0) + 1;
  }

  const activeSessions = allSessions.filter((s) => !s.endedAt).length;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-[var(--landing-text)]">Activity & Sessions</h1>

      <ActivityFeed
        activities={allActivities}
        sessions={allSessions}
        stats={{ totalActions, actionBreakdown, activeSessions, totalSessions: allSessions.length }}
      />
    </div>
  );
}
