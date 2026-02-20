import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { activityLogs } from "@memctl/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/changes?since=<unix_ms>&limit=100
 *
 * Returns a summary of changes (activity log entries) for the project
 * since a given timestamp, grouped by action type.
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
  const sinceParam = url.searchParams.get("since");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "100"),
    500,
  );

  if (!sinceParam) {
    return jsonError("since query parameter (unix ms) is required", 400);
  }

  const sinceMs = parseInt(sinceParam);
  if (isNaN(sinceMs) || sinceMs < 0) {
    return jsonError("since must be a valid unix timestamp in milliseconds", 400);
  }

  const sinceDate = new Date(sinceMs);
  const now = new Date();

  const logs = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.projectId, context.project.id),
        gt(activityLogs.createdAt, sinceDate),
      ),
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  // Group changes by action type and compute summary counts
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const log of logs) {
    switch (log.action) {
      case "memory_write": {
        // Determine if this was a create or update from details if available
        let changeType: string | null = null;
        if (log.details) {
          try {
            const details = JSON.parse(log.details);
            changeType = details.changeType ?? null;
          } catch {
            // ignore parse errors
          }
        }
        if (changeType === "created") {
          created++;
        } else if (changeType === "updated") {
          updated++;
        } else {
          // Default: count memory_write as an update if no explicit type
          updated++;
        }
        break;
      }
      case "memory_delete":
        deleted++;
        break;
      default:
        // Other action types (tool_call, memory_read, etc.) are not counted in the summary
        break;
    }
  }

  const total = created + updated + deleted;

  const changes = logs.map((log) => ({
    action: log.action,
    memoryKey: log.memoryKey,
    toolName: log.toolName,
    createdAt: log.createdAt,
    details: log.details,
  }));

  return NextResponse.json({
    since: sinceMs,
    until: now.getTime(),
    summary: {
      created,
      updated,
      deleted,
      total,
    },
    changes,
  });
}
