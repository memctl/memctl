import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, sessionLogs } from "@memctl/db/schema";
import { eq, and, lt, isNull, isNotNull, sql } from "drizzle-orm";
import { resolveOrgAndProject } from "../../capacity-utils";

/**
 * POST /api/v1/memories/lifecycle/schedule
 *
 * Run scheduled lifecycle policies. Designed to be called by
 * external cron services (Vercel Cron, cron-job.org, etc).
 *
 * Runs all safe automatic policies:
 * - cleanup_expired: delete memories past their expiresAt
 * - cleanup_session_logs: delete session logs older than 30 days
 * - auto_promote: boost priority of frequently accessed memories
 * - auto_demote: lower priority of negatively rated memories
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

  const body = await req.json().catch(() => ({}));
  const sessionLogMaxAgeDays = body.sessionLogMaxAgeDays ?? 30;
  const accessThreshold = body.accessThreshold ?? 10;
  const feedbackThreshold = body.feedbackThreshold ?? 3;

  const results: Record<string, { affected: number }> = {};

  // 1. Cleanup expired memories
  const now = new Date();
  const expired = await db
    .delete(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        lt(memories.expiresAt, now),
        isNotNull(memories.expiresAt),
      ),
    );
  results.cleanup_expired = { affected: expired.rowsAffected ?? 0 };

  // 2. Cleanup old session logs
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sessionLogMaxAgeDays);
  const deletedLogs = await db
    .delete(sessionLogs)
    .where(
      and(
        eq(sessionLogs.projectId, context.project.id),
        lt(sessionLogs.startedAt, cutoff),
      ),
    );
  results.cleanup_session_logs = { affected: deletedLogs.rowsAffected ?? 0 };

  // 3. Auto-promote frequently accessed
  const promoted = await db
    .update(memories)
    .set({ priority: sql`MIN(${memories.priority} + 10, 100)` })
    .where(
      and(
        eq(memories.projectId, context.project.id),
        sql`${memories.accessCount} >= ${accessThreshold}`,
        sql`${memories.priority} < 50`,
        isNull(memories.archivedAt),
      ),
    );
  results.auto_promote = { affected: promoted.rowsAffected ?? 0 };

  // 4. Auto-demote negatively rated
  const demoted = await db
    .update(memories)
    .set({ priority: sql`MAX(${memories.priority} - 10, 0)` })
    .where(
      and(
        eq(memories.projectId, context.project.id),
        sql`${memories.unhelpfulCount} >= ${feedbackThreshold}`,
        sql`${memories.unhelpfulCount} > ${memories.helpfulCount}`,
        sql`${memories.priority} > 0`,
        isNull(memories.archivedAt),
      ),
    );
  results.auto_demote = { affected: demoted.rowsAffected ?? 0 };

  return NextResponse.json({
    scheduled: true,
    ranAt: now.toISOString(),
    results,
  });
}
