import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, organizations, projects } from "@memctl/db/schema";
import { eq, and, isNull, or, like } from "drizzle-orm";

async function resolveOrg(orgSlug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  return org ?? null;
}

/**
 * GET /api/v1/memories/search-org?q=...&limit=...
 *
 * Search memories across all projects in the organization.
 * Requires only X-Org-Slug header. Groups results by project slug.
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

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  if (!query.trim()) {
    return jsonError("Query parameter 'q' is required", 400);
  }

  // Get all projects in org
  const orgProjects = await db
    .select({ id: projects.id, slug: projects.slug, name: projects.name })
    .from(projects)
    .where(eq(projects.orgId, org.id));

  if (orgProjects.length === 0) {
    return NextResponse.json({ results: [], projectsSearched: 0, totalMatches: 0 });
  }

  const pattern = `%${query}%`;

  // Search across all projects using LIKE on key + content
  const allMatches = await db
    .select({
      key: memories.key,
      content: memories.content,
      projectId: memories.projectId,
      priority: memories.priority,
      tags: memories.tags,
      accessCount: memories.accessCount,
      updatedAt: memories.updatedAt,
    })
    .from(memories)
    .where(
      and(
        isNull(memories.archivedAt),
        or(like(memories.key, pattern), like(memories.content, pattern)),
      ),
    );

  // Filter to only memories belonging to org projects and deduplicate
  const projectMap = new Map(orgProjects.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const filtered: Array<{
    key: string;
    contentPreview: string;
    projectSlug: string;
    projectName: string;
    priority: number | null;
    tags: string[] | null;
    accessCount: number;
    updatedAt: unknown;
  }> = [];

  for (const m of allMatches) {
    const project = projectMap.get(m.projectId);
    if (!project) continue;

    const dedup = `${project.slug}::${m.key}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    let parsedTags: string[] | null = null;
    if (m.tags) {
      try { parsedTags = JSON.parse(m.tags); } catch { /* skip */ }
    }

    filtered.push({
      key: m.key,
      contentPreview: (m.content ?? "").slice(0, 200),
      projectSlug: project.slug,
      projectName: project.name,
      priority: m.priority,
      tags: parsedTags,
      accessCount: m.accessCount,
      updatedAt: m.updatedAt,
    });

    if (filtered.length >= limit) break;
  }

  // Group by project slug
  const grouped: Record<string, typeof filtered> = {};
  for (const r of filtered) {
    if (!grouped[r.projectSlug]) grouped[r.projectSlug] = [];
    grouped[r.projectSlug]!.push(r);
  }

  return NextResponse.json({
    results: filtered,
    grouped,
    projectsSearched: orgProjects.length,
    totalMatches: filtered.length,
  });
}
