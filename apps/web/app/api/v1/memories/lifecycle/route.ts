import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, sessionLogs, memoryVersions, activityLogs, webhookEvents, webhookConfigs, memoryLocks } from "@memctl/db/schema";
import { eq, and, lt, isNull, isNotNull, like, sql, inArray } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";
import { computeRelevanceScore } from "@memctl/shared/relevance";

/**
 * POST /api/v1/memories/lifecycle
 *
 * Run lifecycle policies to auto-manage memories:
 * - Archive branch_plan entries for merged/deleted branches
 * - Delete expired session logs (older than N days)
 * - Delete expired memories
 * - Auto-promote frequently accessed memories (boost priority)
 * - Auto-demote memories with negative feedback
 *
 * Body: {
 *   policies: string[],
 *   sessionLogMaxAgeDays?: number,
 *   accessThreshold?: number,
 *   feedbackThreshold?: number,
 *   mergedBranches?: string[]
 * }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.policies)) {
    return jsonError("Body must have policies (string[])", 400);
  }

  const {
    policies,
    sessionLogMaxAgeDays = 30,
    accessThreshold = 10,
    feedbackThreshold = 3,
    mergedBranches = [],
    relevanceThreshold = 5.0,
    healthThreshold = 15,
    maxVersionsPerMemory = 50,
    activityLogMaxAgeDays = 90,
    webhookEventMaxAgeDays = 30,
    archivePurgeDays = 90,
  } = body as {
    policies: string[];
    sessionLogMaxAgeDays?: number;
    accessThreshold?: number;
    feedbackThreshold?: number;
    mergedBranches?: string[];
    relevanceThreshold?: number;
    healthThreshold?: number;
    maxVersionsPerMemory?: number;
    activityLogMaxAgeDays?: number;
    webhookEventMaxAgeDays?: number;
    archivePurgeDays?: number;
  };

  const results: Record<string, { affected: number; details?: string }> = {};

  for (const policy of policies) {
    switch (policy) {
      case "archive_merged_branches": {
        // Archive branch_plan memories for merged branches
        if (mergedBranches.length === 0) {
          results[policy] = { affected: 0, details: "No merged branches provided" };
          break;
        }
        let archived = 0;
        for (const branch of mergedBranches) {
          const encodedBranch = encodeURIComponent(branch);
          const pattern = `agent/context/branch_plan/${encodedBranch}`;
          const branchMemories = await db
            .select()
            .from(memories)
            .where(
              and(
                eq(memories.projectId, context.project.id),
                like(memories.key, `%${pattern}%`),
                isNull(memories.archivedAt),
              ),
            );
          for (const mem of branchMemories) {
            await db
              .update(memories)
              .set({ archivedAt: new Date() })
              .where(eq(memories.id, mem.id));
            archived++;
          }
        }
        results[policy] = { affected: archived };
        break;
      }

      case "cleanup_expired": {
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
        results[policy] = { affected: expired.rowsAffected ?? 0 };
        break;
      }

      case "cleanup_session_logs": {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - sessionLogMaxAgeDays);
        const deleted = await db
          .delete(sessionLogs)
          .where(
            and(
              eq(sessionLogs.projectId, context.project.id),
              lt(sessionLogs.startedAt, cutoff),
            ),
          );
        results[policy] = { affected: deleted.rowsAffected ?? 0 };
        break;
      }

      case "auto_promote": {
        // Boost priority of frequently accessed memories (access >= threshold, priority < 50)
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
        results[policy] = { affected: promoted.rowsAffected ?? 0 };
        break;
      }

      case "auto_demote": {
        // Lower priority of memories with more unhelpful than helpful feedback
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
        results[policy] = { affected: demoted.rowsAffected ?? 0 };
        break;
      }

      case "auto_prune": {
        // Archive memories with low relevance scores
        const allMems = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.projectId, context.project.id),
              isNull(memories.archivedAt),
              isNull(memories.pinnedAt),
            ),
          );
        const now = Date.now();
        let pruned = 0;
        for (const mem of allMems) {
          const score = computeRelevanceScore({
            priority: mem.priority ?? 0,
            accessCount: mem.accessCount ?? 0,
            lastAccessedAt: mem.lastAccessedAt ? new Date(mem.lastAccessedAt).getTime() : null,
            helpfulCount: mem.helpfulCount ?? 0,
            unhelpfulCount: mem.unhelpfulCount ?? 0,
            pinnedAt: null,
          }, now);
          if (score < relevanceThreshold) {
            // Parse existing tags
            let existingTags: string[] = [];
            if (mem.tags) {
              try { existingTags = JSON.parse(mem.tags) as string[]; } catch { /* ignore */ }
            }
            const newTags = [...new Set([...existingTags, "auto:pruned"])];
            await db
              .update(memories)
              .set({ archivedAt: new Date(), tags: JSON.stringify(newTags) })
              .where(eq(memories.id, mem.id));
            pruned++;
          }
        }
        results[policy] = { affected: pruned, details: `Archived memories with relevance < ${relevanceThreshold}` };
        break;
      }

      case "auto_archive_unhealthy": {
        // Archive non-pinned memories with health score below threshold
        const unhealthyMems = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.projectId, context.project.id),
              isNull(memories.archivedAt),
              isNull(memories.pinnedAt),
            ),
          );
        const nowMs = Date.now();
        let archived = 0;
        for (const mem of unhealthyMems) {
          const ageDays = mem.createdAt
            ? (nowMs - mem.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            : 0;
          const daysSinceAccess = mem.lastAccessedAt
            ? (nowMs - mem.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24)
            : Infinity;
          const accessCnt = mem.accessCount ?? 0;
          const helpfulCnt = mem.helpfulCount ?? 0;
          const unhelpfulCnt = mem.unhelpfulCount ?? 0;

          const ageFactor = Math.max(0, 25 - ageDays / 14);
          const accessFactor = Math.min(25, accessCnt * 2.5);
          const feedbackFactor = 12.5 + Math.min(12.5, Math.max(-12.5, (helpfulCnt - unhelpfulCnt) * 2.5));
          const freshnessFactor = daysSinceAccess === Infinity ? 0 : Math.max(0, 25 - daysSinceAccess / 7);
          const healthScore = Math.round((ageFactor + accessFactor + feedbackFactor + freshnessFactor) * 100) / 100;

          if (healthScore < healthThreshold) {
            let existingTags: string[] = [];
            if (mem.tags) {
              try { existingTags = JSON.parse(mem.tags) as string[]; } catch { /* ignore */ }
            }
            const newTags = [...new Set([...existingTags, "auto:decayed"])];
            await db
              .update(memories)
              .set({ archivedAt: new Date(), tags: JSON.stringify(newTags) })
              .where(eq(memories.id, mem.id));
            archived++;
          }
        }
        results[policy] = { affected: archived, details: `Archived memories with health score < ${healthThreshold}` };
        break;
      }

      case "cleanup_old_versions": {
        // Trim old versions — keep latest N per memory, scoped to project's memories
        const projectMemoryIds = await db
          .select({ id: memories.id })
          .from(memories)
          .where(eq(memories.projectId, context.project.id));
        if (projectMemoryIds.length === 0) {
          results[policy] = { affected: 0 };
          break;
        }
        const memIds = projectMemoryIds.map((m) => m.id);
        const trimResult = await db.run(sql`
          DELETE FROM memory_versions
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY memory_id ORDER BY version DESC) AS rn
              FROM memory_versions
              WHERE memory_id IN (${sql.join(memIds.map((id) => sql`${id}`), sql`, `)})
            ) WHERE rn > ${maxVersionsPerMemory}
          )
        `);
        results[policy] = { affected: trimResult.rowsAffected ?? 0 };
        break;
      }

      case "cleanup_activity_logs": {
        const activityCutoff = new Date();
        activityCutoff.setDate(activityCutoff.getDate() - activityLogMaxAgeDays);
        const deletedActivity = await db
          .delete(activityLogs)
          .where(
            and(
              eq(activityLogs.projectId, context.project.id),
              lt(activityLogs.createdAt, activityCutoff),
            ),
          );
        results[policy] = { affected: deletedActivity.rowsAffected ?? 0 };
        break;
      }

      case "cleanup_webhook_events": {
        // Get project's webhook configs, then delete events by configId + age
        const configs = await db
          .select({ id: webhookConfigs.id })
          .from(webhookConfigs)
          .where(eq(webhookConfigs.projectId, context.project.id));
        if (configs.length === 0) {
          results[policy] = { affected: 0 };
          break;
        }
        const configIds = configs.map((c) => c.id);
        const webhookCutoff = new Date();
        webhookCutoff.setDate(webhookCutoff.getDate() - webhookEventMaxAgeDays);
        const deletedWebhooks = await db
          .delete(webhookEvents)
          .where(
            and(
              inArray(webhookEvents.webhookConfigId, configIds),
              lt(webhookEvents.createdAt, webhookCutoff),
            ),
          );
        results[policy] = { affected: deletedWebhooks.rowsAffected ?? 0 };
        break;
      }

      case "cleanup_expired_locks": {
        const nowLock = new Date();
        const deletedLocks = await db
          .delete(memoryLocks)
          .where(
            and(
              eq(memoryLocks.projectId, context.project.id),
              lt(memoryLocks.expiresAt, nowLock),
            ),
          );
        results[policy] = { affected: deletedLocks.rowsAffected ?? 0 };
        break;
      }

      case "purge_archived": {
        const archiveCutoff = new Date();
        archiveCutoff.setDate(archiveCutoff.getDate() - archivePurgeDays);
        const purged = await db
          .delete(memories)
          .where(
            and(
              eq(memories.projectId, context.project.id),
              isNotNull(memories.archivedAt),
              lt(memories.archivedAt, archiveCutoff),
              isNull(memories.pinnedAt),
            ),
          );
        results[policy] = { affected: purged.rowsAffected ?? 0 };
        break;
      }

      default:
        results[policy] = { affected: 0, details: `Unknown policy: ${policy}` };
    }
  }

  return NextResponse.json({ results });
}
