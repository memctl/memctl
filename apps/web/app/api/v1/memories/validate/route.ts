import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/validate
 *
 * Cross-reference validation: check memory contents against a list of
 * known file paths from the repository. Reports memories that reference
 * files/paths that no longer exist.
 *
 * Body: { repoFiles: string[] }
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

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.repoFiles)) {
    return jsonError("Body must have repoFiles (string[])", 400);
  }

  const { repoFiles } = body as { repoFiles: string[] };
  const repoFileSet = new Set(repoFiles);

  // Get all non-archived memories
  const allMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        isNull(memories.archivedAt),
      ),
    );

  // Common file path patterns to look for in content
  const filePathRegex = /(?:^|\s|["'`(])([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+\.[a-zA-Z0-9]+)/gm;

  const issues: Array<{
    key: string;
    referencedPaths: string[];
    missingPaths: string[];
  }> = [];

  for (const mem of allMemories) {
    const referencedPaths: string[] = [];
    const content = `${mem.content} ${mem.metadata ?? ""}`;

    let match;
    filePathRegex.lastIndex = 0;
    while ((match = filePathRegex.exec(content)) !== null) {
      const path = match[1];
      if (path && !referencedPaths.includes(path)) {
        referencedPaths.push(path);
      }
    }

    if (referencedPaths.length === 0) continue;

    const missingPaths = referencedPaths.filter((p) => !repoFileSet.has(p));
    if (missingPaths.length > 0) {
      issues.push({
        key: mem.key,
        referencedPaths,
        missingPaths,
      });
    }
  }

  return NextResponse.json({
    totalMemoriesChecked: allMemories.length,
    issuesFound: issues.length,
    issues,
    recommendation:
      issues.length > 0
        ? "Update or archive memories that reference deleted files."
        : "All file references are valid.",
  });
}
