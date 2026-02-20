import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/analytics
 *
 * Returns usage analytics for all non-archived memories in the project.
 * Includes counts, access patterns, scope breakdown, tag distribution,
 * and age statistics.
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

  // Fetch all non-archived memories for the project
  const allMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
      ),
    );

  const totalMemories = allMemories.length;

  if (totalMemories === 0) {
    return NextResponse.json({
      totalMemories: 0,
      totalAccessCount: 0,
      averagePriority: 0,
      averageHealthScore: 0,
      mostAccessed: [],
      leastAccessed: [],
      neverAccessed: [],
      byScope: { project: 0, shared: 0 },
      byTag: {},
      pinnedCount: 0,
      avgAge: 0,
    });
  }

  // Total access count
  const totalAccessCount = allMemories.reduce(
    (sum, m) => sum + m.accessCount,
    0,
  );

  // Average priority
  const averagePriority =
    allMemories.reduce((sum, m) => sum + (m.priority ?? 0), 0) / totalMemories;

  // Average health score (helpful - unhelpful)
  const averageHealthScore =
    allMemories.reduce(
      (sum, m) => sum + (m.helpfulCount - m.unhelpfulCount),
      0,
    ) / totalMemories;

  // Sort by accessCount descending for most-accessed
  const sortedByAccess = [...allMemories].sort(
    (a, b) => b.accessCount - a.accessCount,
  );

  // Most accessed: top 10
  const mostAccessed = sortedByAccess.slice(0, 10).map((m) => ({
    key: m.key,
    accessCount: m.accessCount,
    lastAccessedAt: m.lastAccessedAt,
  }));

  // Least accessed: bottom 10 with at least 1 access
  const withAccess = sortedByAccess.filter((m) => m.accessCount > 0);
  const leastAccessed = withAccess
    .slice(-10)
    .reverse()
    .map((m) => ({
      key: m.key,
      accessCount: m.accessCount,
      lastAccessedAt: m.lastAccessedAt,
    }));

  // Never accessed
  const neverAccessed = allMemories
    .filter((m) => m.accessCount === 0)
    .map((m) => m.key);

  // By scope
  const byScope = { project: 0, shared: 0 };
  for (const m of allMemories) {
    if (m.scope === "shared") {
      byScope.shared++;
    } else {
      byScope.project++;
    }
  }

  // By tag
  const byTag: Record<string, number> = {};
  for (const m of allMemories) {
    if (!m.tags) continue;
    try {
      const tags = JSON.parse(m.tags) as string[];
      for (const tag of tags) {
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }
    } catch {
      // skip unparseable tags
    }
  }

  // Pinned count
  const pinnedCount = allMemories.filter((m) => m.pinnedAt !== null).length;

  // Average age in days
  const now = Date.now();
  const totalAgeMs = allMemories.reduce(
    (sum, m) => sum + (now - m.createdAt.getTime()),
    0,
  );
  const avgAge = Math.round(totalAgeMs / totalMemories / (1000 * 60 * 60 * 24));

  return NextResponse.json({
    totalMemories,
    totalAccessCount,
    averagePriority: Math.round(averagePriority * 100) / 100,
    averageHealthScore: Math.round(averageHealthScore * 100) / 100,
    mostAccessed,
    leastAccessed,
    neverAccessed,
    byScope,
    byTag,
    pinnedCount,
    avgAge,
  });
}
