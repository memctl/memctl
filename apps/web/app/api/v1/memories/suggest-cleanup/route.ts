import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull, asc, lt } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/suggest-cleanup
 *
 * Suggests memories that could be archived or deleted based on:
 * - Low access count + old lastAccessedAt (stale memories)
 * - Low priority + old updatedAt
 * - Already expired but not yet cleaned
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const staleDays = parseInt(url.searchParams.get("stale_days") ?? "30");

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays);

  // Find stale memories: not accessed recently, low access count, not archived
  const staleMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
        lt(memories.updatedAt, staleDate),
      ),
    )
    .orderBy(asc(memories.accessCount), asc(memories.lastAccessedAt))
    .limit(limit);

  // Find expired memories
  const now = new Date();
  const expiredMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
        lt(memories.expiresAt, now),
      ),
    )
    .limit(limit);

  return NextResponse.json({
    stale: staleMemories.map((m) => ({
      key: m.key,
      accessCount: m.accessCount,
      lastAccessedAt: m.lastAccessedAt,
      updatedAt: m.updatedAt,
      priority: m.priority,
      reason: "Not updated in " + staleDays + " days, low access count",
    })),
    expired: expiredMemories.map((m) => ({
      key: m.key,
      expiresAt: m.expiresAt,
      reason: "Past expiration date",
    })),
    staleDaysThreshold: staleDays,
  });
}
