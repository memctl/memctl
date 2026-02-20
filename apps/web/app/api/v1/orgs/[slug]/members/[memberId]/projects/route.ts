import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projectMembers,
  projects,
} from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { projectAssignmentSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug, memberId } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const [targetMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.id, memberId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const assignments = await db
    .select({
      projectId: projectMembers.projectId,
    })
    .from(projectMembers)
    .where(eq(projectMembers.userId, targetMember.userId));

  return NextResponse.json({
    projectIds: assignments.map((a) => a.projectId),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug, memberId } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember || currentMember.role === "member") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [targetMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.id, memberId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Validate project IDs belong to this org
  if (parsed.data.projectIds.length > 0) {
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.orgId, org.id),
          inArray(projects.id, parsed.data.projectIds),
        ),
      );

    const validIds = new Set(orgProjects.map((p) => p.id));
    const invalid = parsed.data.projectIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid project IDs: ${invalid.join(", ")}` },
        { status: 400 },
      );
    }
  }

  // Get all org project IDs to scope the deletion
  const allOrgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, org.id));

  const orgProjectIds = allOrgProjects.map((p) => p.id);

  // Remove existing assignments for this org's projects
  if (orgProjectIds.length > 0) {
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, targetMember.userId),
          inArray(projectMembers.projectId, orgProjectIds),
        ),
      );
  }

  // Insert new assignments
  if (parsed.data.projectIds.length > 0) {
    await db.insert(projectMembers).values(
      parsed.data.projectIds.map((projectId) => ({
        id: generateId(),
        projectId,
        userId: targetMember.userId,
        createdAt: new Date(),
      })),
    );
  }

  return NextResponse.json({ projectIds: parsed.data.projectIds });
}
