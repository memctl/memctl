import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  memories,
} from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  const serialized = memoryList.map((m) => ({
    ...m,
    createdAt: m.createdAt?.toISOString() ?? "",
    updatedAt: m.updatedAt?.toISOString() ?? "",
    archivedAt: m.archivedAt?.toISOString() ?? null,
    expiresAt: m.expiresAt?.toISOString() ?? null,
    pinnedAt: m.pinnedAt?.toISOString() ?? null,
    lastAccessedAt: m.lastAccessedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ result: serialized });
}
