import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { getOrgMemoryCapacity, resolveOrgAndProject } from "../capacity-utils";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, isNull } from "drizzle-orm";
import { computeRelevanceScore, computeRelevanceDistribution } from "@memctl/shared/relevance";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) {
    return jsonError("Project not found", 404);
  }

  const capacity = await getOrgMemoryCapacity(
    context.org.id,
    context.org.planId,
    context.project.id,
  );

  // Compute relevance distribution for active memories
  const activeMemories = await db
    .select({
      priority: memories.priority,
      accessCount: memories.accessCount,
      lastAccessedAt: memories.lastAccessedAt,
      helpfulCount: memories.helpfulCount,
      unhelpfulCount: memories.unhelpfulCount,
      pinnedAt: memories.pinnedAt,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
      ),
    );

  const now = Date.now();
  const scores = activeMemories.map((m) =>
    computeRelevanceScore({
      priority: m.priority ?? 0,
      accessCount: m.accessCount ?? 0,
      lastAccessedAt: m.lastAccessedAt ? new Date(m.lastAccessedAt).getTime() : null,
      helpfulCount: m.helpfulCount ?? 0,
      unhelpfulCount: m.unhelpfulCount ?? 0,
      pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).getTime() : null,
    }, now),
  );
  const relevanceDistribution = computeRelevanceDistribution(scores);

  return NextResponse.json({
    used: capacity.used,
    limit: capacity.limit,
    orgUsed: capacity.orgUsed,
    orgLimit: capacity.orgLimit,
    isFull: capacity.isFull,
    isSoftFull: capacity.isSoftFull,
    isApproaching: capacity.isApproaching,
    usageRatio: capacity.usageRatio,
    relevanceDistribution,
  });
}
