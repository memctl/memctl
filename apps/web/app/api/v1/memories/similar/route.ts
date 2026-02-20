import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull, ne, isNotNull } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";
import { generateEmbedding, cosineSimilarity, deserializeEmbedding } from "@/lib/embeddings";

/**
 * POST /api/v1/memories/similar
 *
 * Find memories with similar content using vector embeddings (preferred)
 * or Jaccard word overlap (fallback when embeddings are unavailable).
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

  const conditions = [
    eq(memories.projectId, context.project.id),
    isNull(memories.archivedAt),
  ];
  if (excludeKey) {
    conditions.push(ne(memories.key, excludeKey));
  }

  // Try vector similarity first
  const queryEmbedding = await generateEmbedding(content);

  if (queryEmbedding) {
    const withEmbeddings = await db
      .select({
        key: memories.key,
        priority: memories.priority,
        embedding: memories.embedding,
      })
      .from(memories)
      .where(and(...conditions, isNotNull(memories.embedding)));

    if (withEmbeddings.length > 0) {
      const similar = withEmbeddings
        .map((m) => {
          try {
            const emb = deserializeEmbedding(m.embedding!);
            const sim = cosineSimilarity(queryEmbedding, emb);
            return { key: m.key, priority: m.priority, similarity: Math.round(sim * 100) / 100 };
          } catch {
            return null;
          }
        })
        .filter((m): m is NonNullable<typeof m> => m !== null && m.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);

      return NextResponse.json({ similar });
    }
  }

  // Fallback to Jaccard word overlap
  const allMemories = await db
    .select({ key: memories.key, content: memories.content, priority: memories.priority })
    .from(memories)
    .where(and(...conditions));

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
