import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/batch
 *
 * Batch mutations on multiple memories at once.
 * Supports: archive, unarchive, delete, tag, set_priority, pin, unpin
 *
 * Body: { keys: string[], action: string, value?: unknown }
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
  if (!body || !Array.isArray(body.keys) || !body.action) {
    return jsonError("Body must have keys (string[]) and action (string)", 400);
  }

  const { keys, action, value } = body as {
    keys: string[];
    action: string;
    value?: unknown;
  };

  if (keys.length === 0 || keys.length > 100) {
    return jsonError("keys must have 1-100 entries", 400);
  }

  // Get matching memories
  const matching = await db
    .select({ id: memories.id, key: memories.key })
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        inArray(memories.key, keys),
      ),
    );

  if (matching.length === 0) {
    return jsonError("No matching memories found", 404);
  }

  const matchingIds = matching.map((m) => m.id);
  const now = new Date();
  let affected = 0;

  switch (action) {
    case "archive":
      await db
        .update(memories)
        .set({ archivedAt: now })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "unarchive":
      await db
        .update(memories)
        .set({ archivedAt: null })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "delete":
      await db
        .delete(memories)
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "pin":
      await db
        .update(memories)
        .set({ pinnedAt: now })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "unpin":
      await db
        .update(memories)
        .set({ pinnedAt: null })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "set_priority":
      if (typeof value !== "number" || value < 0 || value > 100) {
        return jsonError("value must be a number 0-100 for set_priority", 400);
      }
      await db
        .update(memories)
        .set({ priority: value })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    case "add_tags": {
      if (!Array.isArray(value)) {
        return jsonError("value must be a string[] for add_tags", 400);
      }
      // Need to merge tags individually
      for (const mem of matching) {
        const [full] = await db
          .select({ tags: memories.tags })
          .from(memories)
          .where(eq(memories.id, mem.id))
          .limit(1);

        let existing: string[] = [];
        if (full?.tags) {
          try { existing = JSON.parse(full.tags); } catch { /* ignore */ }
        }
        const merged = [...new Set([...existing, ...(value as string[])])];
        await db
          .update(memories)
          .set({ tags: JSON.stringify(merged) })
          .where(eq(memories.id, mem.id));
        affected++;
      }
      break;
    }

    case "set_scope":
      if (value !== "project" && value !== "shared") {
        return jsonError("value must be 'project' or 'shared' for set_scope", 400);
      }
      await db
        .update(memories)
        .set({ scope: value })
        .where(inArray(memories.id, matchingIds));
      affected = matchingIds.length;
      break;

    default:
      return jsonError(
        `Unknown action "${action}". Valid: archive, unarchive, delete, pin, unpin, set_priority, add_tags, set_scope`,
        400,
      );
  }

  return NextResponse.json({
    action,
    requested: keys.length,
    matched: matching.length,
    affected,
  });
}
