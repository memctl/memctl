import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memoryLocks } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";
import { generateId } from "@/lib/utils";

/**
 * POST /api/v1/memories/lock
 *
 * Acquire a lock on a memory key with an optional TTL.
 * Prevents concurrent writes to the same key by multiple agents.
 *
 * Body: { key: string, lockedBy?: string, ttlSeconds?: number }
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
  if (!body || typeof body.key !== "string") {
    return jsonError("Body must have key (string)", 400);
  }

  const {
    key,
    lockedBy = null,
    ttlSeconds = 60,
  } = body as { key: string; lockedBy?: string; ttlSeconds?: number };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Check if a lock already exists for this project + key
  const [existing] = await db
    .select()
    .from(memoryLocks)
    .where(
      and(
        eq(memoryLocks.projectId, context.project.id),
        eq(memoryLocks.memoryKey, key),
      ),
    )
    .limit(1);

  if (existing) {
    // Lock exists — check if it has expired
    if (existing.expiresAt >= now) {
      // Still active — conflict
      return NextResponse.json(
        {
          error: "Lock already held",
          lock: {
            key,
            lockedBy: existing.lockedBy,
            expiresAt: existing.expiresAt,
          },
          acquired: false,
        },
        { status: 409 },
      );
    }

    // Expired — delete the stale lock and create a new one
    await db.delete(memoryLocks).where(eq(memoryLocks.id, existing.id));
  }

  // Create the new lock
  await db.insert(memoryLocks).values({
    id: generateId(),
    projectId: context.project.id,
    memoryKey: key,
    lockedBy,
    expiresAt,
  });

  return NextResponse.json({
    lock: { key, lockedBy, expiresAt },
    acquired: true,
  });
}

/**
 * DELETE /api/v1/memories/lock
 *
 * Release a lock on a memory key.
 * If lockedBy is provided, only releases when the holder matches.
 *
 * Body: { key: string, lockedBy?: string }
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body.key !== "string") {
    return jsonError("Body must have key (string)", 400);
  }

  const { key, lockedBy = null } = body as { key: string; lockedBy?: string };

  // Find the lock
  const [existing] = await db
    .select()
    .from(memoryLocks)
    .where(
      and(
        eq(memoryLocks.projectId, context.project.id),
        eq(memoryLocks.memoryKey, key),
      ),
    )
    .limit(1);

  if (!existing) {
    return jsonError("No lock found for this key", 404);
  }

  // If lockedBy is provided, ensure the caller owns the lock
  if (lockedBy && existing.lockedBy !== lockedBy) {
    return jsonError(
      `Lock is held by "${existing.lockedBy}", not "${lockedBy}"`,
      403,
    );
  }

  await db.delete(memoryLocks).where(eq(memoryLocks.id, existing.id));

  return NextResponse.json({ key, released: true });
}
