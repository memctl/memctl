import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  users,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Only admins/owners can see member list
  if (member.role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);
  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const orgMembers = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const serialized = await Promise.all(
    orgMembers.map(async (m) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);

      const [assignment] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, m.userId),
          ),
        )
        .limit(1);

      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }
          : null,
        assignedToProject: !!assignment,
      };
    }),
  );

  return NextResponse.json({ result: serialized });
}
