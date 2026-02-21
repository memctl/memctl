import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, sessionLogs } from "@memctl/db/schema";
import { eq, and, lt, isNull, isNotNull, like, sql } from "drizzle-orm";
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
  } = body as {
    policies: string[];
    sessionLogMaxAgeDays?: number;
    accessThreshold?: number;
    feedbackThreshold?: number;
    mergedBranches?: string[];
    relevanceThreshold?: number;
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
              try { existingTags = JSON.parse(mem.tags) as string[]; } catch {}
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

      default:
        results[policy] = { affected: 0, details: `Unknown policy: ${policy}` };
    }
  }

  return NextResponse.json({ results });
}
