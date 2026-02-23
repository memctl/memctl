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
import { eq, and, desc, lt, gte, or, sql, inArray } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectSlug: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug, projectSlug } = await params;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const action = url.searchParams.get("action");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search");
  const type = url.searchParams.get("type") ?? "all";

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, session.user.id)))
    .limit(1);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check project access for members
  if (member.role === "member") {
    const [assignment] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id)))
      .limit(1);
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch activities
  let activities: Array<{
    id: string; action: string; toolName: string | null; memoryKey: string | null;
    details: string | null; sessionId: string | null; projectName: string;
    createdByName: string | null; createdAt: string;
  }> = [];
  let activityHasMore = false;

  if (type !== "audit") {
    const conditions = [eq(activityLogs.projectId, project.id)];
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
        createdAt: activityLogs.createdAt,
        createdByName: users.name,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit + 1);

    activityHasMore = rows.length > limit;
    activities = rows.slice(0, limit).map((a) => ({
      id: a.id,
      action: a.action,
      toolName: a.toolName,
      memoryKey: a.memoryKey,
      details: a.details,
      sessionId: a.sessionId,
      projectName: project.name,
      createdByName: a.createdByName ?? null,
      createdAt: a.createdAt?.toISOString() ?? "",
    }));
  }

  // Fetch audit logs
  let serializedAuditLogs: Array<{
    id: string; action: string; actorName: string; targetUserName: string | null;
    details: string | null; createdAt: string;
  }> = [];
  let auditHasMore = false;

  if (type !== "activity") {
    const auditConditions = [
      or(
        eq(auditLogs.projectId, project.id),
        and(eq(auditLogs.orgId, org.id), sql`${auditLogs.projectId} IS NULL`),
      ),
    ];
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

    auditHasMore = auditRows.length > limit;

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

  // Determine cursor
  const allDates = [
    ...activities.map((a) => a.createdAt),
    ...serializedAuditLogs.map((a) => a.createdAt),
  ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const hasMore = activityHasMore || auditHasMore;
  const nextCursor = hasMore && allDates.length > 0 ? allDates[allDates.length - 1] : null;

  return NextResponse.json({
    activities,
    auditLogs: serializedAuditLogs,
    nextCursor,
    hasMore,
  });
}
