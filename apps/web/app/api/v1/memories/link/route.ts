import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/link
 *
 * Link or unlink related memories. Relationships are bidirectional.
 *
 * Body: { key: string, relatedKey: string, unlink?: boolean }
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
    typeof body.relatedKey !== "string"
  ) {
    return jsonError(
      "Body must have key (string) and relatedKey (string)",
      400,
    );
  }

  const {
    key,
    relatedKey,
    unlink = false,
  } = body as {
    key: string;
    relatedKey: string;
    unlink?: boolean;
  };

  if (key === relatedKey) {
    return jsonError("Cannot link a memory to itself", 400);
  }

  // Get both memories
  const [memA] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, context.project.id), eq(memories.key, key)),
    )
    .limit(1);

  const [memB] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        eq(memories.key, relatedKey),
      ),
    )
    .limit(1);

  if (!memA) return jsonError(`Memory "${key}" not found`, 404);
  if (!memB) return jsonError(`Memory "${relatedKey}" not found`, 404);

  // Parse existing related keys
  const parseRelated = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  };

  let relatedA = parseRelated(memA.relatedKeys);
  let relatedB = parseRelated(memB.relatedKeys);

  if (unlink) {
    relatedA = relatedA.filter((k) => k !== relatedKey);
    relatedB = relatedB.filter((k) => k !== key);
  } else {
    if (!relatedA.includes(relatedKey)) relatedA.push(relatedKey);
    if (!relatedB.includes(key)) relatedB.push(key);
  }

  await db
    .update(memories)
    .set({ relatedKeys: JSON.stringify(relatedA) })
    .where(eq(memories.id, memA.id));

  await db
    .update(memories)
    .set({ relatedKeys: JSON.stringify(relatedB) })
    .where(eq(memories.id, memB.id));

  return NextResponse.json({
    key,
    relatedKey,
    action: unlink ? "unlinked" : "linked",
    keyRelatedKeys: relatedA,
    relatedKeyRelatedKeys: relatedB,
  });
}
