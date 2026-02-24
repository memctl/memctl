import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { resolveOrgAndProject } from "../capacity-utils";
import { memories } from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * GET /api/v1/memories/traverse?key=<key>&depth=2
 *
 * BFS graph traversal from a starting memory, following relatedKeys up to `depth` hops.
 * Returns nodes, edges, and whether max depth was reached.
 */
export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const startKey = url.searchParams.get("key");
  const depthParam = parseInt(url.searchParams.get("depth") ?? "2", 10);

  if (!startKey) {
    return jsonError("key query param is required", 400);
  }

  const depth = Math.min(Math.max(depthParam, 1), 5);

  // BFS traversal
  const visited = new Map<
    string,
    { key: string; content: string; depth: number }
  >();
  const edges: Array<{ from: string; to: string }> = [];
  let queue: Array<{ key: string; depth: number }> = [
    { key: startKey, depth: 0 },
  ];
  let maxDepthReached = false;

  while (queue.length > 0) {
    const nextQueue: Array<{ key: string; depth: number }> = [];

    // Batch-fetch all keys in the current queue level
    const keysToFetch = queue
      .filter((item) => !visited.has(item.key))
      .map((item) => item.key);

    if (keysToFetch.length === 0) break;

    const rows = await db
      .select({
        key: memories.key,
        content: memories.content,
        relatedKeys: memories.relatedKeys,
      })
      .from(memories)
      .where(
        and(
          eq(memories.projectId, context.project.id),
          inArray(memories.key, keysToFetch),
        ),
      );

    const rowMap = new Map(rows.map((r) => [r.key, r]));

    for (const item of queue) {
      if (visited.has(item.key)) continue;

      const row = rowMap.get(item.key);
      if (!row) continue;

      visited.set(item.key, {
        key: row.key,
        content: row.content,
        depth: item.depth,
      });

      // Parse relatedKeys and follow edges
      let related: string[] = [];
      if (row.relatedKeys) {
        try {
          related = JSON.parse(row.relatedKeys) as string[];
        } catch {
          /* ignore */
        }
      }

      for (const relKey of related) {
        edges.push({ from: item.key, to: relKey });
        if (!visited.has(relKey)) {
          if (item.depth + 1 <= depth) {
            nextQueue.push({ key: relKey, depth: item.depth + 1 });
          } else {
            maxDepthReached = true;
          }
        }
      }
    }

    queue = nextQueue;
  }

  return NextResponse.json({
    root: startKey,
    nodes: Array.from(visited.values()),
    edges,
    maxDepthReached,
  });
}
