import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions, projects, organizations } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { memoryUpdateSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";

async function resolveProject(orgSlug: string, projectSlug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  return project ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const project = await resolveProject(orgSlug, projectSlug);
  if (!project) return jsonError("Project not found", 404);

  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, project.id),
        eq(memories.key, decodeURIComponent(key)),
      ),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  return NextResponse.json({ memory });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const project = await resolveProject(orgSlug, projectSlug);
  if (!project) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = memoryUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message, 400);

  const decodedKey = decodeURIComponent(key);
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, decodedKey)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  // Save version before updating
  const [latestVersion] = await db
    .select({ version: memoryVersions.version })
    .from(memoryVersions)
    .where(eq(memoryVersions.memoryId, existing.id))
    .orderBy(desc(memoryVersions.version))
    .limit(1);

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  await db.insert(memoryVersions).values({
    id: generateId(),
    memoryId: existing.id,
    version: nextVersion,
    content: existing.content,
    metadata: existing.metadata,
    changedBy: authResult.userId,
    changeType: "updated",
    createdAt: new Date(),
  });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.content) updates.content = parsed.data.content;
  if (parsed.data.metadata) updates.metadata = JSON.stringify(parsed.data.metadata);
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.tags !== undefined) updates.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.expiresAt !== undefined) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }

  await db.update(memories).set(updates).where(eq(memories.id, existing.id));

  return NextResponse.json({
    memory: { ...existing, ...updates },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const project = await resolveProject(orgSlug, projectSlug);
  if (!project) return jsonError("Project not found", 404);

  const decodedKey = decodeURIComponent(key);
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, decodedKey)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  await db.delete(memories).where(eq(memories.id, existing.id));

  return NextResponse.json({ deleted: true });
}
