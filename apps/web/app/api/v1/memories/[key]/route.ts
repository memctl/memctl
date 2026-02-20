import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError, checkRateLimit } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions } from "@memctl/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { memoryUpdateSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../capacity-utils";
import { generateETag, checkConditional } from "@/lib/etag";
import { generateEmbedding, serializeEmbedding } from "@/lib/embeddings";
import { dispatchWebhooks } from "@/lib/webhook-dispatch";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);
  const { project } = context;

  const [memory] = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, project.id),
        eq(memories.key, decodeURIComponent(key)),
      ),
    )
    .limit(1);

  if (!memory) return jsonError("Memory not found", 404);

  // Track access (fire-and-forget)
  db.update(memories)
    .set({
      accessCount: sql`${memories.accessCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(memories.id, memory.id))
    .then(() => {}, () => {});

  const body = JSON.stringify({ memory });
  const etag = generateETag(body);

  if (checkConditional(req, etag)) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);
  const { project } = context;

  const body = await req.json().catch(() => null);
  const parsed = memoryUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message, 400);

  const decodedKey = decodeURIComponent(key);
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, decodedKey)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  // Optimistic concurrency: check If-Match header
  const ifMatch = req.headers.get("if-match");
  if (ifMatch) {
    const currentEtag = generateETag(JSON.stringify({ memory: existing }));
    if (ifMatch !== currentEtag) {
      return jsonError("Conflict: memory has been modified since last read", 409);
    }
  }

  // Save version before updating
  const [latestVersion] = await db
    .select({ version: memoryVersions.version })
    .from(memoryVersions)
    .where(eq(memoryVersions.memoryId, existing.id))
    .orderBy(desc(memoryVersions.version))
    .limit(1);

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  await db.insert(memoryVersions).values({
    id: generateId(),
    memoryId: existing.id,
    version: nextVersion,
    content: existing.content,
    metadata: existing.metadata,
    changedBy: authResult.userId,
    changeType: "updated",
    createdAt: new Date(),
  });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.content) updates.content = parsed.data.content;
  if (parsed.data.metadata) updates.metadata = JSON.stringify(parsed.data.metadata);
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.tags !== undefined) updates.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.expiresAt !== undefined) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }

  await db.update(memories).set(updates).where(eq(memories.id, existing.id));

  // Regenerate embedding if content changed (fire-and-forget)
  if (parsed.data.content || parsed.data.tags) {
    const text = `${decodedKey} ${parsed.data.content ?? existing.content} ${parsed.data.tags?.join(" ") ?? ""}`;
    generateEmbedding(text).then((emb) => {
      if (emb) {
        db.update(memories)
          .set({ embedding: serializeEmbedding(emb) })
          .where(eq(memories.id, existing.id))
          .then(() => {}, () => {});
      }
    }).catch(() => {});
  }

  // Dispatch webhooks (fire-and-forget)
  dispatchWebhooks(project.id, [
    { type: "memory.updated", payload: { key: decodedKey, projectId: project.id } },
  ]).catch(() => {});

  return NextResponse.json({
    memory: { ...existing, ...updates },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { key } = await params;
  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);
  const { project } = context;

  const decodedKey = decodeURIComponent(key);
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, decodedKey)),
    )
    .limit(1);

  if (!existing) return jsonError("Memory not found", 404);

  // Optimistic concurrency: check If-Match header
  const ifMatch = req.headers.get("if-match");
  if (ifMatch) {
    const currentEtag = generateETag(JSON.stringify({ memory: existing }));
    if (ifMatch !== currentEtag) {
      return jsonError("Conflict: memory has been modified since last read", 409);
    }
  }

  await db.delete(memories).where(eq(memories.id, existing.id));

  // Dispatch webhooks (fire-and-forget)
  dispatchWebhooks(project.id, [
    { type: "memory.deleted", payload: { key: decodedKey, projectId: project.id } },
  ]).catch(() => {});

  return NextResponse.json({ deleted: true });
}
