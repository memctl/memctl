import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  jsonError,
  checkRateLimit,
} from "@/lib/api-middleware";
import { db } from "@/lib/db";
import {
  memories,
  memoryVersions,
  projects,
  activityLogs,
} from "@memctl/db/schema";
import { eq, and, like, isNull, inArray, desc, or, lt } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { memoryStoreSchema } from "@memctl/shared/validators";
import { getOrgMemoryCapacity, resolveOrgAndProject } from "./capacity-utils";
import {
  ensureFts,
  ftsSearch,
  vectorSearch,
  mergeSearchResults,
} from "@/lib/fts";
import { generateETag, checkConditional } from "@/lib/etag";
import { generateEmbedding, serializeEmbedding } from "@/lib/embeddings";
import { validateContent } from "@/lib/schema-validator";
import { contextTypes } from "@memctl/db/schema";
import { computeRelevanceScore } from "@memctl/shared/relevance";

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
  if (!context) {
    return jsonError("Project not found", 404);
  }
  const { org, project } = context;

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const tagsFilter = url.searchParams.get("tags"); // comma-separated
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const includeShared = url.searchParams.get("include_shared") !== "false"; // opt-in by default
  const sortBy = url.searchParams.get("sort") ?? "updated"; // "updated" | "priority" | "created" | "relevance"
  const afterCursor = url.searchParams.get("after"); // cursor-based pagination (memory ID)

  // Get org project IDs for shared memory inclusion
  let sharedProjectIds: string[] = [];
  if (includeShared) {
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, org.id));
    sharedProjectIds = orgProjects
      .map((p) => p.id)
      .filter((id) => id !== project.id);
  }

  // Build scope filter: own project memories + shared memories from other projects
  const scopeFilter =
    sharedProjectIds.length > 0
      ? or(
          eq(memories.projectId, project.id),
          and(
            inArray(memories.projectId, sharedProjectIds),
            eq(memories.scope, "shared"),
          ),
        )
      : eq(memories.projectId, project.id);

  let results;

  if (query) {
    // Try FTS5 search first
    await ensureFts();
    const ftsIds = await ftsSearch(project.id, query, limit);

    if (ftsIds && ftsIds.length > 0) {
      results = await db
        .select()
        .from(memories)
        .where(
          and(
            inArray(memories.id, ftsIds),
            includeArchived ? undefined : isNull(memories.archivedAt),
          ),
        )
        .limit(limit);
    } else {
      // Fallback to LIKE queries
      const keyResults = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.projectId, project.id),
            like(memories.key, `%${query}%`),
            includeArchived ? undefined : isNull(memories.archivedAt),
          ),
        )
        .limit(limit)
        .offset(offset);

      const contentResults = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.projectId, project.id),
            like(memories.content, `%${query}%`),
            includeArchived ? undefined : isNull(memories.archivedAt),
          ),
        )
        .limit(limit);

      // Merge and deduplicate
      const seen = new Set(keyResults.map((r) => r.id));
      results = [...keyResults];
      for (const r of contentResults) {
        if (!seen.has(r.id)) {
          results.push(r);
          seen.add(r.id);
        }
      }
      results = results.slice(0, limit);
    }
  } else {
    const orderClause =
      sortBy === "priority"
        ? desc(memories.priority)
        : sortBy === "created"
          ? desc(memories.createdAt)
          : desc(memories.updatedAt);

    // Cursor-based pagination: fetch items after the cursor record
    // Always use updatedAt for cursor comparison (consistent non-null column)
    let cursorFilter = undefined;
    if (afterCursor) {
      const [cursorRow] = await db
        .select({ id: memories.id, updatedAt: memories.updatedAt })
        .from(memories)
        .where(eq(memories.id, afterCursor))
        .limit(1);

      if (cursorRow) {
        cursorFilter = lt(memories.updatedAt, cursorRow.updatedAt);
      }
    }

    results = await db
      .select()
      .from(memories)
      .where(
        and(
          scopeFilter,
          includeArchived ? undefined : isNull(memories.archivedAt),
          cursorFilter,
        ),
      )
      .orderBy(orderClause)
      .limit(limit)
      .offset(afterCursor ? 0 : offset);
  }

  // Filter by tags if requested
  if (tagsFilter && results.length > 0) {
    const requestedTags = tagsFilter
      .split(",")
      .map((t) => t.trim().toLowerCase());
    results = results.filter((m) => {
      if (!m.tags) return false;
      try {
        const memTags = JSON.parse(m.tags) as string[];
        return requestedTags.some((t) => memTags.includes(t));
      } catch {
        return false;
      }
    });
  }

  // Weighted ranking: compute composite relevance score when searching
  if (query && results.length > 1) {
    const now = Date.now();
    const scored = results.map((m) => {
      const priority = m.priority ?? 0;
      const accessCount = m.accessCount ?? 0;
      const helpful = m.helpfulCount ?? 0;
      const unhelpful = m.unhelpfulCount ?? 0;
      const lastAccess = m.lastAccessedAt
        ? new Date(m.lastAccessedAt).getTime()
        : 0;
      const daysSinceAccess = lastAccess
        ? (now - lastAccess) / 86_400_000
        : 999;
      const isPinned = m.pinnedAt ? 1 : 0;

      // Composite score (higher = more relevant)
      const priorityScore = priority * 0.3;
      const accessScore = Math.min(25, accessCount * 2) * 0.2;
      const feedbackScore = Math.max(0, (helpful - unhelpful) * 3) * 0.15;
      const recencyScore = Math.max(0, 25 - daysSinceAccess / 3) * 0.2;
      const pinBoost = isPinned * 15;

      return {
        memory: m,
        _relevanceScore:
          Math.round(
            (priorityScore +
              accessScore +
              feedbackScore +
              recencyScore +
              pinBoost) *
              100,
          ) / 100,
      };
    });
    scored.sort((a, b) => b._relevanceScore - a._relevanceScore);
    results = scored.map((s) => s.memory);
  }

  // Hybrid search: run vector search in parallel when query is provided
  if (query && results.length > 0) {
    try {
      const vectorIds = await vectorSearch(project.id, query, limit);
      if (vectorIds && vectorIds.length > 0) {
        const ftsIds = results.map((r) => r.id);
        const mergedIds = mergeSearchResults(ftsIds, vectorIds, limit);

        // Fetch any vector-only results not already in results
        const existingIds = new Set(results.map((r) => r.id));
        const missingIds = mergedIds.filter(
          (id: string) => !existingIds.has(id),
        );

        if (missingIds.length > 0) {
          const extra = await db
            .select()
            .from(memories)
            .where(inArray(memories.id, missingIds));
          results.push(...extra);
        }

        // Reorder by merged ranking
        const idOrder = new Map<string, number>(
          mergedIds.map((id: string, i: number) => [id, i] as [string, number]),
        );
        results.sort((a, b) => {
          const orderA: number = idOrder.get(a.id) ?? 999;
          const orderB: number = idOrder.get(b.id) ?? 999;
          return orderA - orderB;
        });
        results = results.slice(0, limit);
      }
    } catch {
      // Vector search failed — continue with keyword results only
    }
  }

  // Compute relevance scores for each memory
  const now = Date.now();
  const memoriesWithRelevance = results.map((m) => ({
    ...m,
    relevance_score: computeRelevanceScore(
      {
        priority: m.priority ?? 0,
        accessCount: m.accessCount ?? 0,
        lastAccessedAt: m.lastAccessedAt
          ? new Date(m.lastAccessedAt).getTime()
          : null,
        helpfulCount: m.helpfulCount ?? 0,
        unhelpfulCount: m.unhelpfulCount ?? 0,
        pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).getTime() : null,
      },
      now,
    ),
  }));

  // Sort by relevance if requested
  if (sortBy === "relevance") {
    memoriesWithRelevance.sort((a, b) => b.relevance_score - a.relevance_score);
  }

  // Include cursor for next page
  const nextCursor =
    memoriesWithRelevance.length === limit
      ? memoriesWithRelevance[memoriesWithRelevance.length - 1]?.id
      : undefined;
  const body = JSON.stringify({
    memories: memoriesWithRelevance,
    ...(nextCursor ? { nextCursor } : {}),
  });
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

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const rateLimitRes = await checkRateLimit(authResult);
  if (rateLimitRes) return rateLimitRes;

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
  if (!context) {
    return jsonError("Project not found", 404);
  }
  const { org, project } = context;

  const body = await req.json().catch(() => null);
  const parsed = memoryStoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { key, content, metadata, scope, priority, tags, expiresAt } =
    parsed.data;

  // Validate content against context type schema if applicable
  if (metadata && typeof metadata === "object" && "contextType" in metadata) {
    const ctSlug = String((metadata as Record<string, unknown>).contextType);
    const [ct] = await db
      .select({ schema: contextTypes.schema })
      .from(contextTypes)
      .where(and(eq(contextTypes.orgId, org.id), eq(contextTypes.slug, ctSlug)))
      .limit(1);
    if (ct?.schema) {
      const validation = validateContent(ct.schema, content);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Content validation failed", details: validation.errors },
          { status: 422 },
        );
      }
    }
  }

  await ensureFts();

  // Upsert: update if exists, create if not
  const [existing] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.projectId, project.id), eq(memories.key, key)))
    .limit(1);

  if (existing) {
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

    const updates: Record<string, unknown> = {
      content,
      updatedAt: new Date(),
    };
    if (metadata !== undefined) updates.metadata = JSON.stringify(metadata);
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    if (expiresAt !== undefined)
      updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

    // Unarchive if re-storing an archived memory
    if (existing.archivedAt) {
      updates.archivedAt = null;
    }

    await db.update(memories).set(updates).where(eq(memories.id, existing.id));

    // Generate embedding async (fire-and-forget)
    generateEmbedding(`${key} ${content} ${tags?.join(" ") ?? ""}`)
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

    // Log activity (fire-and-forget)
    db.insert(activityLogs)
      .values({
        id: generateId(),
        projectId: project.id,
        action: "memory_write",
        memoryKey: key,
        details: JSON.stringify({ changeType: "updated" }),
        createdBy: authResult.userId,
        createdAt: new Date(),
      })
      .then(
        () => {},
        () => {},
      );

    return NextResponse.json({ memory: { ...existing, ...updates } });
  }

  const capacity = await getOrgMemoryCapacity(org, project.id);

  if (capacity.isFull) {
    const limitText = capacity.limit < 999999 ? capacity.limit : "∞";
    return NextResponse.json(
      {
        error: `Project memory limit reached (${capacity.used}/${limitText}). Delete or archive existing memories before storing new ones.`,
      },
      { status: 409 },
    );
  }

  const id = generateId();
  const now = new Date();
  await db.insert(memories).values({
    id,
    projectId: project.id,
    key,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    scope: scope ?? "project",
    priority: priority ?? 0,
    tags: tags ? JSON.stringify(tags) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdBy: authResult.userId,
    createdAt: now,
    updatedAt: now,
  });

  // Create initial version
  await db.insert(memoryVersions).values({
    id: generateId(),
    memoryId: id,
    version: 1,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    changedBy: authResult.userId,
    changeType: "created",
    createdAt: now,
  });

  // Generate embedding async (fire-and-forget)
  generateEmbedding(`${key} ${content} ${tags?.join(" ") ?? ""}`)
    .then((emb) => {
      if (emb) {
        db.update(memories)
          .set({ embedding: JSON.stringify(Array.from(emb)) })
          .where(eq(memories.id, id))
          .then(
            () => {},
            () => {},
          );
      }
    })
    .catch(() => {});

  // Log activity (fire-and-forget)
  db.insert(activityLogs)
    .values({
      id: generateId(),
      projectId: project.id,
      action: "memory_write",
      memoryKey: key,
      details: JSON.stringify({ changeType: "created" }),
      createdBy: authResult.userId,
      createdAt: now,
    })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json(
    {
      memory: {
        id,
        projectId: project.id,
        key,
        content,
        metadata: metadata ?? null,
        priority: priority ?? 0,
        tags: tags ?? null,
        expiresAt: expiresAt ?? null,
        createdBy: authResult.userId,
        createdAt: now,
        updatedAt: now,
      },
    },
    { status: 201 },
  );
}
