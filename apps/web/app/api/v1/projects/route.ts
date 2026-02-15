import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  organizations,
  organizationMembers,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { projectCreateSchema } from "@memctl/shared/validators";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json(
      { error: "org query parameter is required" },
      { status: 400 },
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify membership
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

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  return NextResponse.json({ projects: projectList });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org");
  if (!orgSlug) {
    return NextResponse.json(
      { error: "org query parameter is required" },
      { status: 400 },
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify admin or owner
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

  // Check project limit
  const existingProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  if (existingProjects.length >= org.projectLimit) {
    return NextResponse.json(
      { error: "Project limit reached. Upgrade your plan." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Check slug uniqueness within org
  const [existingSlug] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.orgId, org.id), eq(projects.slug, parsed.data.slug)),
    )
    .limit(1);

  if (existingSlug) {
    return NextResponse.json(
      { error: "Project slug already exists in this organization" },
      { status: 409 },
    );
  }

  const projectId = generateId();
  const now = new Date();

  await db.insert(projects).values({
    id: projectId,
    orgId: org.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return NextResponse.json({ project }, { status: 201 });
}
