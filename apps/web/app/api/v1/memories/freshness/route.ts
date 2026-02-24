import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, sql } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/freshness
 *
 * Lightweight freshness check. Returns aggregate timestamps and a count
 * so agents can quickly tell if their cached context is still valid
 * without downloading any content.
 */
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

  const [result] = await db
    .select({
      count: sql<number>`count(*)`,
      latestUpdate: sql<number>`max(${memories.updatedAt})`,
      latestCreate: sql<number>`max(${memories.createdAt})`,
      checksum: sql<string>`group_concat(${memories.key} || ':' || ${memories.updatedAt}, ',')`,
    })
    .from(memories)
    .where(eq(memories.projectId, context.project.id));

  // Simple hash from the checksum string
  const checksumStr = result?.checksum ?? "";
  let hash = 0;
  for (let i = 0; i < checksumStr.length; i++) {
    const char = checksumStr.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hexHash = (hash >>> 0).toString(16).padStart(8, "0");

  return NextResponse.json({
    memoryCount: result?.count ?? 0,
    latestUpdate: result?.latestUpdate ?? null,
    latestCreate: result?.latestCreate ?? null,
    hash: hexHash,
    checkedAt: Date.now(),
  });
}
