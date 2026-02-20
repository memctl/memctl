import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { memoryBulkGetSchema } from "@memctl/shared/validators";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/bulk — retrieve multiple memories by keys in a single request
 * Body: { keys: string[] }
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
  const parsed = memoryBulkGetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { keys } = parsed.data;

  const results = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        inArray(memories.key, keys),
      ),
    );

  // Return as a map for easy lookup
  const memoryMap: Record<string, typeof results[number]> = {};
  for (const memory of results) {
    memoryMap[memory.key] = memory;
  }

  return NextResponse.json({
    memories: memoryMap,
    found: results.length,
    requested: keys.length,
  });
}
