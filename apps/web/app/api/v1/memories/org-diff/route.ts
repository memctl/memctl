import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireOrgMembership, checkProjectAccess, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, organizations, projects } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function resolveOrg(orgSlug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  return org ?? null;
}

/**
 * GET /api/v1/memories/org-diff?project_a=...&project_b=...
 *
 * Compare memories between two projects in the same org.
 * Returns keys only in A, only in B, and common (with content match flag).
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const org = await resolveOrg(orgSlug);
  if (!org) return jsonError("Organization not found", 404);

  const role = await requireOrgMembership(authResult.userId, org.id);
  if (!role) return jsonError("Not a member", 403);

  const { searchParams } = new URL(req.url);
  const slugA = searchParams.get("project_a");
  const slugB = searchParams.get("project_b");

  if (!slugA || !slugB) {
    return jsonError("Both project_a and project_b query parameters are required", 400);
  }

  if (slugA === slugB) {
    return jsonError("project_a and project_b must be different", 400);
  }

  // Resolve both projects
  const [projectA] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, slugA)))
    .limit(1);

  const [projectB] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, slugB)))
    .limit(1);

  if (!projectA) return jsonError(`Project '${slugA}' not found in org`, 404);
  if (!projectB) return jsonError(`Project '${slugB}' not found in org`, 404);

  // Check access to both projects for members
  const [hasAccessA, hasAccessB] = await Promise.all([
    checkProjectAccess(authResult.userId, projectA.id, role),
    checkProjectAccess(authResult.userId, projectB.id, role),
  ]);
  if (!hasAccessA) return jsonError(`Project '${slugA}' not found in org`, 404);
  if (!hasAccessB) return jsonError(`Project '${slugB}' not found in org`, 404);

  // Load non-archived memories from each project
  const [memoriesA, memoriesB] = await Promise.all([
    db
      .select({ key: memories.key, content: memories.content, priority: memories.priority })
      .from(memories)
      .where(and(eq(memories.projectId, projectA.id), isNull(memories.archivedAt))),
    db
      .select({ key: memories.key, content: memories.content, priority: memories.priority })
      .from(memories)
      .where(and(eq(memories.projectId, projectB.id), isNull(memories.archivedAt))),
  ]);

  const mapA = new Map(memoriesA.map((m) => [m.key, m]));
  const mapB = new Map(memoriesB.map((m) => [m.key, m]));

  const onlyInA: Array<{ key: string; priority: number | null }> = [];
  const onlyInB: Array<{ key: string; priority: number | null }> = [];
  const common: Array<{ key: string; contentMatch: boolean }> = [];

  for (const [key, mem] of mapA) {
    const bMem = mapB.get(key);
    if (!bMem) {
      onlyInA.push({ key, priority: mem.priority });
    } else {
      common.push({ key, contentMatch: mem.content === bMem.content });
    }
  }

  for (const [key, mem] of mapB) {
    if (!mapA.has(key)) {
      onlyInB.push({ key, priority: mem.priority });
    }
  }

  return NextResponse.json({
    projectA: slugA,
    projectB: slugB,
    onlyInA,
    onlyInB,
    common,
    stats: {
      totalA: memoriesA.length,
      totalB: memoriesB.length,
      onlyInA: onlyInA.length,
      onlyInB: onlyInB.length,
      common: common.length,
      contentMatches: common.filter((c) => c.contentMatch).length,
      contentDiffers: common.filter((c) => !c.contentMatch).length,
    },
  });
}
