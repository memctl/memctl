import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { resolveOrgAndProject } from "../capacity-utils";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * GET /api/v1/memories/health?limit=50
 *
 * Health score endpoint. Computes a 0-100 health score for each memory
 * based on age, access frequency, feedback, and freshness.
 *
 * Returns memories sorted by health score ascending (worst health first)
 * so agents can prioritise maintenance on the most degraded entries.
 *
 * Factors (each 0-25, total 0-100):
 *   age      - newer memories score higher: max(0, 25 - ageDays / 14)
 *   access   - more accesses score higher: min(25, accessCount * 2.5)
 *   feedback - net-positive feedback scores higher: 12.5 + min(12.5, (helpful - unhelpful) * 2.5)
 *   freshness- recently accessed scores higher: max(0, 25 - daysSinceAccess / 7)
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
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200,
  );

  // Fetch all non-archived memories for this project
  const allMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
      ),
    );

  const now = Date.now();

  const scored = allMemories.map((m) => {
    const ageDays = m.createdAt
      ? (now - m.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const daysSinceAccess = m.lastAccessedAt
      ? (now - m.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    const accessCount = m.accessCount ?? 0;
    const helpfulCount = m.helpfulCount ?? 0;
    const unhelpfulCount = m.unhelpfulCount ?? 0;

    // Age factor (0-25): newer = higher
    const ageFactor = Math.max(0, 25 - ageDays / 14);

    // Access factor (0-25): more access = higher
    const accessFactor = Math.min(25, accessCount * 2.5);

    // Feedback factor (0-25): positive feedback = higher
    // Baseline of 12.5 so memories with no feedback get a neutral score
    const feedbackFactor =
      12.5 +
      Math.min(12.5, Math.max(-12.5, (helpfulCount - unhelpfulCount) * 2.5));

    // Freshness factor (0-25): recently accessed = higher
    const freshnessFactor =
      daysSinceAccess === Infinity ? 0 : Math.max(0, 25 - daysSinceAccess / 7);

    const healthScore =
      Math.round(
        (ageFactor + accessFactor + feedbackFactor + freshnessFactor) * 100,
      ) / 100;

    return {
      key: m.key,
      healthScore,
      factors: {
        age: Math.round(ageFactor * 100) / 100,
        access: Math.round(accessFactor * 100) / 100,
        feedback: Math.round(feedbackFactor * 100) / 100,
        freshness: Math.round(freshnessFactor * 100) / 100,
      },
      priority: m.priority,
      accessCount,
      lastAccessedAt: m.lastAccessedAt,
      isPinned: Boolean(m.pinnedAt),
    };
  });

  // Sort by health score ascending (worst health first)
  scored.sort((a, b) => a.healthScore - b.healthScore);

  return NextResponse.json({
    memories: scored.slice(0, limit),
  });
}
