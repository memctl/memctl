import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../capacity-utils";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(
    orgSlug,
    projectSlug,
    authResult.userId,
  );
  if (!context) return jsonError("Project not found", 404);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  if (!key) {
    return jsonError("key query parameter is required", 400);
  }

  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  const versions = await db
    .select()
    .from(memoryVersions)
    .where(eq(memoryVersions.memoryId, memory.id))
    .orderBy(desc(memoryVersions.version))
    .limit(limit);

  return NextResponse.json({
    key: memory.key,
    currentVersion: versions.length > 0 ? versions[0].version : 0,
    versions,
  });
}

/**
 * POST /api/v1/memories/versions — restore a memory to a previous version
 * Body: { key: string, version: number }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(
    orgSlug,
    projectSlug,
    authResult.userId,
  );
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body?.key || typeof body.version !== "number") {
    return jsonError("key (string) and version (number) are required", 400);
  }

  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        eq(memories.key, body.key),
      ),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  const [targetVersion] = await db
    .select()
    .from(memoryVersions)
    .where(
      and(
        eq(memoryVersions.memoryId, memory.id),
        eq(memoryVersions.version, body.version),
      ),
    )
    .limit(1);

  if (!targetVersion) return jsonError("Version not found", 404);

  // Save current state as a new version before restoring
  const [latestVersion] = await db
    .select({ version: memoryVersions.version })
    .from(memoryVersions)
    .where(eq(memoryVersions.memoryId, memory.id))
    .orderBy(desc(memoryVersions.version))
    .limit(1);

  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const now = new Date();

  await db.insert(memoryVersions).values({
    id: generateId(),
    memoryId: memory.id,
    version: nextVersion,
    content: memory.content,
    metadata: memory.metadata,
    changedBy: authResult.userId,
    changeType: "restored",
    createdAt: now,
  });

  // Restore content and metadata from target version
  await db
    .update(memories)
    .set({
      content: targetVersion.content,
      metadata: targetVersion.metadata,
      updatedAt: now,
    })
    .where(eq(memories.id, memory.id));

  return NextResponse.json({
    memory: {
      ...memory,
      content: targetVersion.content,
      metadata: targetVersion.metadata,
      updatedAt: now,
    },
    restoredFromVersion: body.version,
    newVersion: nextVersion,
  });
}
