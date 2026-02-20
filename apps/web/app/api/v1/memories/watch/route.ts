import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, inArray, gt } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/watch
 *
 * Check if specific memory keys have been modified since a given timestamp.
 * Useful for detecting concurrent modifications by other agents/users.
 *
 * Body: { keys: string[], since: number (unix ms) }
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
  if (!body || !Array.isArray(body.keys) || typeof body.since !== "number") {
    return jsonError("Body must have keys (string[]) and since (unix ms timestamp)", 400);
  }

  const { keys, since } = body as { keys: string[]; since: number };

  if (keys.length === 0 || keys.length > 100) {
    return jsonError("keys must have 1-100 entries", 400);
  }

  const sinceDate = new Date(since);

  const changed = await db
    .select({
      key: memories.key,
      updatedAt: memories.updatedAt,
      content: memories.content,
    })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        inArray(memories.key, keys),
        gt(memories.updatedAt, sinceDate),
      ),
    );

  return NextResponse.json({
    changed: changed.map((m) => ({
      key: m.key,
      updatedAt: m.updatedAt,
      contentPreview: m.content?.slice(0, 200),
    })),
    unchanged: keys.filter((k) => !changed.some((c) => c.key === k)),
    checkedAt: Date.now(),
  });
}
