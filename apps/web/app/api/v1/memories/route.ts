import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions } from "@memctl/db/schema";
import { eq, and, like, isNull, inArray, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { memoryStoreSchema } from "@memctl/shared/validators";
import { getOrgMemoryCapacity, resolveOrgAndProject } from "./capacity-utils";
import { ensureFts, ftsSearch } from "@/lib/fts";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) {
    return jsonError("Project not found", 404);
  }
  const { project } = context;

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const tagsFilter = url.searchParams.get("tags"); // comma-separated
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const sortBy = url.searchParams.get("sort") ?? "updated"; // "updated" | "priority" | "created"

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

    results = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, project.id),
          includeArchived ? undefined : isNull(memories.archivedAt),
        ),
      )
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);
  }

  // Filter by tags if requested
  if (tagsFilter && results.length > 0) {
    const requestedTags = tagsFilter.split(",").map((t) => t.trim().toLowerCase());
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

  return NextResponse.json({ memories: results });
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) {
    return jsonError("Project not found", 404);
  }
  const { org, project } = context;

  const body = await req.json().catch(() => null);
  const parsed = memoryStoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { key, content, metadata, priority, tags, expiresAt } = parsed.data;

  await ensureFts();

  // Upsert: update if exists, create if not
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, key)),
    )
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
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

    // Unarchive if re-storing an archived memory
    if (existing.archivedAt) {
      updates.archivedAt = null;
    }

    await db
      .update(memories)
      .set(updates)
      .where(eq(memories.id, existing.id));

    return NextResponse.json({ memory: { ...existing, ...updates } });
  }

  const capacity = await getOrgMemoryCapacity(org.id, org.planId, project.id);

  // Hard block only on org-wide limit (abuse prevention)
  if (capacity.isFull) {
    const limitText = Number.isFinite(capacity.orgLimit) ? capacity.orgLimit : "∞";
    return NextResponse.json(
      {
        error: `Organization memory limit reached (${capacity.orgUsed}/${limitText}). Delete or archive existing memories before storing new ones.`,
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
