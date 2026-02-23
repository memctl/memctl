import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  sessionLogs,
} from "@memctl/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
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
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 200);

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

  if (member.role === "member") {
    const [assignment] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, session.user.id)))
      .limit(1);
    if (!assignment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conditions = [eq(sessionLogs.projectId, project.id)];
  if (cursor) conditions.push(lt(sessionLogs.startedAt, new Date(cursor)));

  const rows = await db
    .select()
    .from(sessionLogs)
    .where(and(...conditions))
    .orderBy(desc(sessionLogs.startedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = rows.slice(0, limit);
  const nextCursor = hasMore && trimmed.length > 0
    ? trimmed[trimmed.length - 1].startedAt?.toISOString() ?? null
    : null;

  return NextResponse.json({
    sessions: trimmed.map((s) => ({
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
    })),
    nextCursor,
    hasMore,
  });
}
