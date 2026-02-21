import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  organizations,
  organizationMembers,
  projectMembers,
} from "@memctl/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { projectCreateSchema } from "@memctl/shared/validators";
import { headers } from "next/headers";
import { isUnlimited } from "@/lib/plans";

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

  // For members, filter to assigned projects only
  let accessibleProjectIds: string[] | null = null;
  if (member.role === "member") {
    const assignments = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, session.user.id));

    const orgProjectIds = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, org.id));

    const orgIdSet = new Set(orgProjectIds.map((p) => p.id));
    accessibleProjectIds = assignments
      .map((a) => a.projectId)
      .filter((id) => orgIdSet.has(id));
  }

  // Pagination
  const pageParam = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const perPageParam = parseInt(req.nextUrl.searchParams.get("per_page") ?? "20", 10);
  const page = Math.max(1, pageParam);
  const perPage = Math.max(1, Math.min(100, perPageParam));
  const offset = (page - 1) * perPage;

  const projectFilter = accessibleProjectIds !== null
    ? accessibleProjectIds.length > 0
      ? and(eq(projects.orgId, org.id), inArray(projects.id, accessibleProjectIds))
      : undefined
    : eq(projects.orgId, org.id);

  // If member has no project access, return empty
  if (accessibleProjectIds !== null && accessibleProjectIds.length === 0) {
    return NextResponse.json({
      projects: [],
      pagination: { page, perPage, total: 0, totalPages: 0 },
    });
  }

  const [totalResult, projectList] = await Promise.all([
    db
      .select({ value: count() })
      .from(projects)
      .where(projectFilter),
    db
      .select()
      .from(projects)
      .where(projectFilter)
      .limit(perPage)
      .offset(offset),
  ]);

  const total = totalResult[0]?.value ?? 0;

  return NextResponse.json({
    projects: projectList,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  });
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

  if (!isUnlimited(org.projectLimit) && existingProjects.length >= org.projectLimit) {
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

  // Auto-assign creator to the new project
  await db.insert(projectMembers).values({
    id: generateId(),
    projectId,
    userId: session.user.id,
    createdAt: now,
  });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return NextResponse.json({ project }, { status: 201 });
}
