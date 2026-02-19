import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  organizationMembers,
  memories,
  apiTokens,
} from "@memctl/db/schema";
import { eq, and, count, isNull } from "drizzle-orm";
import { headers } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, org.id));

  const [memberCount] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const [tokenCount] = await db
    .select({ value: count() })
    .from(apiTokens)
    .where(
      and(eq(apiTokens.orgId, org.id), isNull(apiTokens.revokedAt)),
    );

  // Memory counts per project
  const memoryByProject: { name: string; count: number }[] = [];
  let totalMemories = 0;

  for (const project of projectList) {
    const [result] = await db
      .select({ value: count() })
      .from(memories)
      .where(eq(memories.projectId, project.id));
    const memCount = result?.value ?? 0;
    totalMemories += memCount;
    memoryByProject.push({ name: project.name, count: memCount });
  }

  return NextResponse.json({
    projects: projectList.length,
    members: memberCount?.value ?? 0,
    memories: totalMemories,
    tokens: tokenCount?.value ?? 0,
    memoryByProject,
  });
}
