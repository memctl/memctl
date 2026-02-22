import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  organizations,
  organizationMembers,
  projectMembers,
  memories,
  sessionLogs,
  activityLogs,
  memorySnapshots,
  memoryLocks,
  webhookConfigs,
  webhookEvents,
} from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { projectUpdateSchema } from "@memctl/shared/validators";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org query parameter required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, slug)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Check project-level access for members
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

    if (!assignment) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org query parameter required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

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

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, slug)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  await db.update(projects).set(updates).where(eq(projects.id, project.id));

  const [updated] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, project.id))
    .limit(1);

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json({ error: "org query parameter required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

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

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, slug)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 1. Delete webhook events via webhook configs, then delete configs
  const configs = await db
    .select({ id: webhookConfigs.id })
    .from(webhookConfigs)
    .where(eq(webhookConfigs.projectId, project.id));
  if (configs.length > 0) {
    const configIds = configs.map((c) => c.id);
    await db.delete(webhookEvents).where(inArray(webhookEvents.webhookConfigId, configIds));
    await db.delete(webhookConfigs).where(eq(webhookConfigs.projectId, project.id));
  }

  // 2. Delete child records by projectId
  await db.delete(memoryLocks).where(eq(memoryLocks.projectId, project.id));
  await db.delete(memorySnapshots).where(eq(memorySnapshots.projectId, project.id));
  await db.delete(activityLogs).where(eq(activityLogs.projectId, project.id));
  await db.delete(sessionLogs).where(eq(sessionLogs.projectId, project.id));

  // 3. Delete project members, memories (versions cascade), then project
  await db.delete(projectMembers).where(eq(projectMembers.projectId, project.id));
  await db.delete(memories).where(eq(memories.projectId, project.id));
  await db.delete(projects).where(eq(projects.id, project.id));

  return NextResponse.json({ deleted: true });
}
