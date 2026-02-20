import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNotNull, lt } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/archive — archive or unarchive memories
 * Body: { key: string, archive: boolean }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body?.key || typeof body.archive !== "boolean") {
    return jsonError("key (string) and archive (boolean) are required", 400);
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

  const now = new Date();
  await db
    .update(memories)
    .set({
      archivedAt: body.archive ? now : null,
      updatedAt: now,
    })
    .where(eq(memories.id, memory.id));

  return NextResponse.json({
    memory: {
      ...memory,
      archivedAt: body.archive ? now : null,
      updatedAt: now,
    },
    action: body.archive ? "archived" : "unarchived",
  });
}

/**
 * DELETE /api/v1/memories/archive — cleanup expired memories
 * Deletes all memories past their expiresAt date.
 */
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const now = new Date();

  // Find expired memories
  const expired = await db
    .select({ id: memories.id })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNotNull(memories.expiresAt),
        lt(memories.expiresAt, now),
      ),
    );

  if (expired.length > 0) {
    for (const { id } of expired) {
      await db.delete(memories).where(eq(memories.id, id));
    }
  }

  return NextResponse.json({
    cleaned: expired.length,
  });
}
