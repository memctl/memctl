import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { resolveOrgAndProject } from "../capacity-utils";
import { activityLogs } from "@memctl/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * GET /api/v1/memories/co-accessed?key=<key>&limit=5
 *
 * Mines activity logs for co-access patterns. Finds sessions that accessed the
 * given key, then returns other memory keys accessed in those same sessions,
 * ranked by co-occurrence frequency.
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
  const key = url.searchParams.get("key");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10), 20);

  if (!key) {
    return jsonError("key query param is required", 400);
  }

  // Find sessions that accessed this key
  const sessionsWithKey = await db
    .select({ sessionId: activityLogs.sessionId })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.projectId, context.project.id),
        eq(activityLogs.action, "memory_read"),
        eq(activityLogs.memoryKey, key),
      ),
    );

  const sessionIds = [...new Set(
    sessionsWithKey
      .map((s) => s.sessionId)
      .filter((id): id is string => id !== null),
  )];

  if (sessionIds.length === 0) {
    return NextResponse.json({ key, coAccessed: [] });
  }

  // Find other keys accessed in those sessions, count co-occurrences
  const coAccessRows = await db
    .select({
      memoryKey: activityLogs.memoryKey,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.projectId, context.project.id),
        eq(activityLogs.action, "memory_read"),
        sql`${activityLogs.sessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`,
        sql`${activityLogs.memoryKey} != ${key}`,
        sql`${activityLogs.memoryKey} IS NOT NULL`,
      ),
    )
    .groupBy(activityLogs.memoryKey)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  const coAccessed = coAccessRows.map((r) => ({
    key: r.memoryKey,
    count: Number(r.count),
  }));

  return NextResponse.json({ key, coAccessed });
}
