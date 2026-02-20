import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * POST /api/v1/memories/similar
 *
 * Find memories with similar content using trigram-like comparison.
 * Uses normalized word overlap to detect near-duplicates without embeddings.
 *
 * Body: { content: string, excludeKey?: string, threshold?: number }
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
  if (!body || typeof body.content !== "string") {
    return jsonError("Body must have content (string)", 400);
  }

  const { content, excludeKey, threshold = 0.6 } = body as {
    content: string;
    excludeKey?: string;
    threshold?: number;
  };

  // Get all non-archived memories for this project
  const conditions = [
    eq(memories.projectId, context.project.id),
    isNull(memories.archivedAt),
  ];

  if (excludeKey) {
    conditions.push(ne(memories.key, excludeKey));
  }

  const allMemories = await db
    .select({ key: memories.key, content: memories.content, priority: memories.priority })
    .from(memories)
    .where(and(...conditions));

  // Simple word-overlap similarity
  const inputWords = extractWords(content);
  if (inputWords.size === 0) {
    return NextResponse.json({ similar: [] });
  }

  const similar = allMemories
    .map((m) => {
      const memWords = extractWords(m.content);
      const similarity = jaccardSimilarity(inputWords, memWords);
      return { key: m.key, priority: m.priority, similarity: Math.round(similarity * 100) / 100 };
    })
    .filter((m) => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  return NextResponse.json({ similar });
}

function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
