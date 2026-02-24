import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";
import { generateId } from "@/lib/utils";

/**
 * POST /api/v1/memories/rollback
 *
 * Undo the last N write operations on a specific memory key.
 * Uses the version history to restore previous content.
 *
 * Body: { key: string, steps?: number }
 * steps defaults to 1 (undo the last change)
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
  if (!body || typeof body.key !== "string") {
    return jsonError("Body must have key (string)", 400);
  }

  const { key, steps = 1 } = body as { key: string; steps?: number };
  const stepsBack = Math.max(1, Math.min(steps, 50));

  // Find the memory
  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  // Get version history, ordered by version desc
  const versions = await db
    .select()
    .from(memoryVersions)
    .where(eq(memoryVersions.memoryId, memory.id))
    .orderBy(desc(memoryVersions.version))
    .limit(stepsBack + 1);

  if (versions.length <= stepsBack) {
    return jsonError(
      `Not enough version history. Memory has ${versions.length} versions, requested ${stepsBack} steps back.`,
      400,
    );
  }

  // The target version is `stepsBack` positions from the latest
  const targetVersion = versions[stepsBack]!;

  // Save current state as a new version before rollback
  const latestVersion = versions[0]!;
  const newVersionNum = latestVersion.version + 1;

  await db.insert(memoryVersions).values({
    id: generateId(),
    memoryId: memory.id,
    version: newVersionNum,
    content: memory.content,
    metadata: memory.metadata,
    changedBy: authResult.userId,
    changeType: "restored",
    createdAt: new Date(),
  });

  // Restore the memory to the target version
  await db
    .update(memories)
    .set({
      content: targetVersion.content,
      metadata: targetVersion.metadata,
      updatedAt: new Date(),
    })
    .where(eq(memories.id, memory.id));

  return NextResponse.json({
    key,
    rolledBackTo: targetVersion.version,
    stepsBack: stepsBack,
    previousContent:
      memory.content.slice(0, 200) + (memory.content.length > 200 ? "..." : ""),
    restoredContent:
      targetVersion.content.slice(0, 200) +
      (targetVersion.content.length > 200 ? "..." : ""),
    newVersion: newVersionNum,
  });
}
