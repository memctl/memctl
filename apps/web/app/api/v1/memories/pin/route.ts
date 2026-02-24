import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/pin
 *
 * Pin or unpin a memory. Pinned memories are always included in bootstrap
 * and never suggested for cleanup.
 *
 * Body: { key: string, pin: boolean }
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
  if (!body || typeof body.key !== "string" || typeof body.pin !== "boolean") {
    return jsonError("Body must have key (string) and pin (boolean)", 400);
  }

  const { key, pin } = body as { key: string; pin: boolean };

  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  await db
    .update(memories)
    .set({ pinnedAt: pin ? new Date() : null })
    .where(eq(memories.id, existing.id));

  return NextResponse.json({
    key,
    pinned: pin,
    message: pin ? `Memory "${key}" pinned` : `Memory "${key}" unpinned`,
  });
}
