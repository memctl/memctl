import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/feedback
 *
 * Rate a memory as helpful or unhelpful. Feedback scores influence
 * priority suggestions and cleanup recommendations.
 *
 * Body: { key: string, helpful: boolean }
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.key !== "string" ||
    typeof body.helpful !== "boolean"
  ) {
    return jsonError("Body must have key (string) and helpful (boolean)", 400);
  }

  const { key, helpful } = body as { key: string; helpful: boolean };

  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  if (helpful) {
    await db
      .update(memories)
      .set({ helpfulCount: sql`${memories.helpfulCount} + 1` })
      .where(eq(memories.id, existing.id));
  } else {
    await db
      .update(memories)
      .set({ unhelpfulCount: sql`${memories.unhelpfulCount} + 1` })
      .where(eq(memories.id, existing.id));
  }

  return NextResponse.json({
    key,
    feedback: helpful ? "helpful" : "unhelpful",
    helpfulCount: existing.helpfulCount + (helpful ? 1 : 0),
    unhelpfulCount: existing.unhelpfulCount + (!helpful ? 1 : 0),
  });
}
