import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { resolveOrgAndProject } from "../capacity-utils";
import { memories, activityLogs } from "@memctl/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

/**
 * GET /api/v1/memories/delta?since=<unix_ms_timestamp>
 *
 * Delta bootstrap endpoint. Returns memories changed since a given timestamp.
 *
 * - created: memories with createdAt > since (and createdAt === updatedAt, meaning never edited after creation)
 * - updated: memories with updatedAt > since (and createdAt !== updatedAt, meaning edited after creation)
 * - deleted: memory keys found in activity_logs with action "memory_delete" since the timestamp
 *
 * Response: { created: Memory[], updated: Memory[], deleted: string[], since: number, now: number }
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

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");

  if (!sinceParam) {
    return jsonError("since query param is required (unix ms timestamp)", 400);
  }

  const sinceMs = parseInt(sinceParam, 10);
  if (Number.isNaN(sinceMs)) {
    return jsonError("since must be a valid unix ms timestamp", 400);
  }

  const sinceDate = new Date(sinceMs);
  const now = Date.now();

  // Fetch all non-archived memories changed since the given timestamp
  const changedMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        gt(memories.updatedAt, sinceDate),
        isNull(memories.archivedAt),
      ),
    );

  // Split into created vs updated:
  // A memory is "created" if its createdAt is also after the since timestamp,
  // meaning it didn't exist before the delta window.
  const created = changedMemories.filter(
    (m) => m.createdAt && m.createdAt.getTime() > sinceMs,
  );
  const createdIds = new Set(created.map((m) => m.id));
  const updated = changedMemories.filter((m) => !createdIds.has(m.id));

  // For deleted memories, query activity_logs for "memory_delete" actions since the timestamp.
  // This is the only reliable way to track deletes without a dedicated tombstone table.
  const deleteActions = await db
    .select({
      memoryKey: activityLogs.memoryKey,
    })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.projectId, context.project.id),
        eq(activityLogs.action, "memory_delete"),
        gt(activityLogs.createdAt, sinceDate),
      ),
    );

  const deleted = deleteActions
    .map((a) => a.memoryKey)
    .filter((key): key is string => key !== null);

  return NextResponse.json({
    created,
    updated,
    deleted,
    since: sinceMs,
    now,
  });
}
