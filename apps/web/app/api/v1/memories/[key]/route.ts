import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions, activityLogs } from "@memctl/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { memoryUpdateSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../capacity-utils";
import { generateETag, checkConditional } from "@/lib/etag";
import { generateEmbedding, serializeEmbedding } from "@/lib/embeddings";
import { validateContent } from "@/lib/schema-validator";
import { contextTypes } from "@memctl/db/schema";

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

  const context = await resolveOrgAndProject(
    orgSlug,
    projectSlug,
    authResult.userId,
  );
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

  // Track access (fire-and-forget) + auto-extend TTL if within 24h of expiry
  const accessUpdates: Record<string, unknown> = {
    accessCount: sql`${memories.accessCount} + 1`,
    lastAccessedAt: new Date(),
  };
  if (memory.expiresAt) {
    const msUntilExpiry = new Date(memory.expiresAt).getTime() - Date.now();
    if (msUntilExpiry > 0 && msUntilExpiry < 24 * 60 * 60 * 1000) {
      accessUpdates.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
  db.update(memories)
    .set(accessUpdates)
    .where(eq(memories.id, memory.id))
    .then(
      () => {},
      () => {},
    );

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

  const context = await resolveOrgAndProject(
    orgSlug,
    projectSlug,
    authResult.userId,
  );
  if (!context) return jsonError("Project not found", 404);
  const { org, project } = context;

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
      return jsonError(
        "Conflict: memory has been modified since last read",
        409,
      );
    }
  }

  // Validate content against context type schema if content is changing
  if (parsed.data.content) {
    const existingMeta = existing.metadata
      ? JSON.parse(existing.metadata)
      : null;
    const newMeta = parsed.data.metadata ?? existingMeta;
    if (newMeta && typeof newMeta === "object" && "contextType" in newMeta) {
      const ctSlug = String(newMeta.contextType);
      const [ct] = await db
        .select({ schema: contextTypes.schema })
        .from(contextTypes)
        .where(
          and(eq(contextTypes.orgId, org.id), eq(contextTypes.slug, ctSlug)),
        )
        .limit(1);
      if (ct?.schema) {
        const validation = validateContent(ct.schema, parsed.data.content);
        if (!validation.valid) {
          return NextResponse.json(
            { error: "Content validation failed", details: validation.errors },
            { status: 422 },
          );
        }
      }
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
  if (parsed.data.metadata)
    updates.metadata = JSON.stringify(parsed.data.metadata);
  if (parsed.data.priority !== undefined)
    updates.priority = parsed.data.priority;
  if (parsed.data.tags !== undefined)
    updates.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.expiresAt !== undefined) {
    updates.expiresAt = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null;
  }

  await db.update(memories).set(updates).where(eq(memories.id, existing.id));

  // Regenerate embedding if content changed (fire-and-forget)
  if (parsed.data.content || parsed.data.tags) {
    const text = `${decodedKey} ${parsed.data.content ?? existing.content} ${parsed.data.tags?.join(" ") ?? ""}`;
    generateEmbedding(text)
      .then((emb) => {
        if (emb) {
          db.update(memories)
            .set({ embedding: serializeEmbedding(emb) })
            .where(eq(memories.id, existing.id))
            .then(
              () => {},
              () => {},
            );
        }
      })
      .catch(() => {});
  }

  // Log activity (fire-and-forget)
  db.insert(activityLogs)
    .values({
      id: generateId(),
      projectId: project.id,
      action: "memory_write",
      memoryKey: decodedKey,
      details: JSON.stringify({ changeType: "updated" }),
      createdBy: authResult.userId,
      createdAt: new Date(),
    })
    .then(
      () => {},
      () => {},
    );

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

  const context = await resolveOrgAndProject(
    orgSlug,
    projectSlug,
    authResult.userId,
  );
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
      return jsonError(
        "Conflict: memory has been modified since last read",
        409,
      );
    }
  }

  await db.delete(memories).where(eq(memories.id, existing.id));

  // Log activity (fire-and-forget)
  db.insert(activityLogs)
    .values({
      id: generateId(),
      projectId: project.id,
      action: "memory_delete",
      memoryKey: decodedKey,
      details: null,
      createdBy: authResult.userId,
      createdAt: new Date(),
    })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ deleted: true });
}
