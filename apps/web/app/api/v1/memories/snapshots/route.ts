import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memorySnapshots } from "@memctl/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/snapshots — list snapshots
 * POST /api/v1/memories/snapshots — create a snapshot
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);

  const snapshots = await db
    .select({
      id: memorySnapshots.id,
      name: memorySnapshots.name,
      description: memorySnapshots.description,
      memoryCount: memorySnapshots.memoryCount,
      createdBy: memorySnapshots.createdBy,
      createdAt: memorySnapshots.createdAt,
    })
    .from(memorySnapshots)
    .where(eq(memorySnapshots.projectId, context.project.id))
    .orderBy(desc(memorySnapshots.createdAt))
    .limit(limit);

  return NextResponse.json({ snapshots });
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string") {
    return jsonError("Body must have name (string)", 400);
  }

  const { name, description } = body as { name: string; description?: string };

  // Get all non-archived memories for this project
  const allMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
      ),
    );

  const snapshotData = allMemories.map((m) => ({
    key: m.key,
    content: m.content,
    metadata: m.metadata,
    scope: m.scope,
    priority: m.priority,
    tags: m.tags,
    relatedKeys: m.relatedKeys,
    pinnedAt: m.pinnedAt,
    expiresAt: m.expiresAt,
  }));

  const id = generateId();
  await db.insert(memorySnapshots).values({
    id,
    projectId: context.project.id,
    name,
    description: description ?? null,
    data: JSON.stringify(snapshotData),
    memoryCount: snapshotData.length,
    createdBy: authResult.userId,
    createdAt: new Date(),
  });

  return NextResponse.json(
    { snapshot: { id, name, memoryCount: snapshotData.length } },
    { status: 201 },
  );
}
