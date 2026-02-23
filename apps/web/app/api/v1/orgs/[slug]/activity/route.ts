import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  activityLogs,
  auditLogs,
  users,
} from "@memctl/db/schema";
import { eq, and, desc, lt, gte, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const action = url.searchParams.get("action");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search");
  const type = url.searchParams.get("type") ?? "all"; // all | activity | audit

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, session.user.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Determine accessible project IDs for members
  let projectIds: string[];
  if (member.role === "member") {
    const orgProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.orgId, org.id));
    if (orgProjects.length === 0) {
      return NextResponse.json({ activities: [], auditLogs: [], nextCursor: null, hasMore: false });
    }
    const assignments = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, session.user.id), inArray(projectMembers.projectId, orgProjects.map((p) => p.id))));
    projectIds = assignments.map((a) => a.projectId);
    if (projectIds.length === 0) {
      return NextResponse.json({ activities: [], auditLogs: [], nextCursor: null, hasMore: false });
    }
  } else {
    // Admin/owner: get all project IDs
    const orgProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.orgId, org.id));
    projectIds = orgProjects.map((p) => p.id);
  }

  // Build project name map
  const projectList = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.orgId, org.id));
  const projectNameMap: Record<string, string> = {};
  for (const p of projectList) projectNameMap[p.id] = p.name;

  // Fetch activities
  let activities: Array<{
    id: string; action: string; toolName: string | null; memoryKey: string | null;
    details: string | null; sessionId: string | null; projectName: string;
    createdByName: string | null; createdAt: string;
  }> = [];
  let activityHasMore = false;

  if (type !== "audit" && projectIds.length > 0) {
    const conditions = [inArray(activityLogs.projectId, projectIds)];
    if (cursor) conditions.push(lt(activityLogs.createdAt, new Date(cursor)));
    if (action) conditions.push(eq(activityLogs.action, action));
    if (from) conditions.push(gte(activityLogs.createdAt, new Date(from)));
    if (to) conditions.push(lt(activityLogs.createdAt, new Date(to)));
    if (search) {
      conditions.push(
        sql`(${activityLogs.action} LIKE ${"%" + search + "%"} OR ${activityLogs.memoryKey} LIKE ${"%" + search + "%"} OR ${activityLogs.toolName} LIKE ${"%" + search + "%"})`,
      );
    }

    const rows = await db
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
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit + 1);

    activities = rows.slice(0, limit).map((a) => ({
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

    activityHasMore = rows.length > limit;
  }

  // Fetch audit logs
  let serializedAuditLogs: Array<{
    id: string; action: string; actorName: string; targetUserName: string | null;
    details: string | null; createdAt: string;
  }> = [];

  if (type !== "activity") {
    const auditConditions = [eq(auditLogs.orgId, org.id)];
    if (cursor) auditConditions.push(lt(auditLogs.createdAt, new Date(cursor)));
    if (action) auditConditions.push(eq(auditLogs.action, action));
    if (from) auditConditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) auditConditions.push(lt(auditLogs.createdAt, new Date(to)));
    if (search) {
      auditConditions.push(
        sql`(${auditLogs.action} LIKE ${"%" + search + "%"} OR ${auditLogs.details} LIKE ${"%" + search + "%"})`,
      );
    }

    const auditRows = await db
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
      .where(and(...auditConditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit + 1);

    // Resolve target user names
    const targetUserIds = [...new Set(auditRows.map((a) => a.targetUserId).filter(Boolean))] as string[];
    const targetUserMap: Record<string, string> = {};
    if (targetUserIds.length > 0) {
      const targetUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, targetUserIds));
      for (const u of targetUsers) targetUserMap[u.id] = u.name;
    }

    serializedAuditLogs = auditRows.slice(0, limit).map((a) => ({
      id: a.id,
      action: a.action,
      actorName: a.actorName ?? "Unknown",
      targetUserName: a.targetUserId ? (targetUserMap[a.targetUserId] ?? "Unknown") : null,
      details: a.details,
      createdAt: a.createdAt?.toISOString() ?? "",
    }));
  }

  // Determine cursor from combined results
  const allDates = [
    ...activities.map((a) => a.createdAt),
    ...serializedAuditLogs.map((a) => a.createdAt),
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const hasMore = (type !== "audit" && activityHasMore) || (type !== "activity" && serializedAuditLogs.length >= limit);
  const nextCursor = hasMore && allDates.length > 0 ? allDates[allDates.length - 1] : null;

  return NextResponse.json({
    activities,
    auditLogs: serializedAuditLogs,
    nextCursor,
    hasMore,
  });
}
