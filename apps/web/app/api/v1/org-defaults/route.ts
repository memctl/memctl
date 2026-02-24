import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { orgMemoryDefaults, organizations } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

async function resolveOrg(orgSlug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  return org ?? null;
}

/**
 * GET /api/v1/org-defaults
 *
 * List all org memory defaults.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const org = await resolveOrg(orgSlug);
  if (!org) return jsonError("Organization not found", 404);

  const defaults = await db
    .select()
    .from(orgMemoryDefaults)
    .where(eq(orgMemoryDefaults.orgId, org.id))
    .orderBy(desc(orgMemoryDefaults.updatedAt));

  const parsed = defaults.map((d) => ({
    ...d,
    tags: d.tags ? JSON.parse(d.tags) : null,
    metadata: d.metadata ? JSON.parse(d.metadata) : null,
  }));

  return NextResponse.json({ defaults: parsed });
}

/**
 * POST /api/v1/org-defaults
 *
 * Create or update an org memory default.
 * Body: { key, content, metadata?, priority?, tags? }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const org = await resolveOrg(orgSlug);
  if (!org) return jsonError("Organization not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { key, content, metadata, priority, tags } = body as {
    key?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    priority?: number;
    tags?: string[];
  };

  if (!key || typeof key !== "string") {
    return jsonError("key is required", 400);
  }
  if (!content || typeof content !== "string") {
    return jsonError("content is required", 400);
  }

  // Upsert: check if exists
  const [existing] = await db
    .select()
    .from(orgMemoryDefaults)
    .where(
      and(eq(orgMemoryDefaults.orgId, org.id), eq(orgMemoryDefaults.key, key)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(orgMemoryDefaults)
      .set({
        content,
        metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
        priority: priority ?? existing.priority,
        tags: tags ? JSON.stringify(tags) : existing.tags,
        updatedAt: new Date(),
      })
      .where(eq(orgMemoryDefaults.id, existing.id));

    return NextResponse.json({
      default: { ...existing, content, updated: true },
    });
  }

  const id = generateId();
  const now = new Date();

  await db.insert(orgMemoryDefaults).values({
    id,
    orgId: org.id,
    key,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    priority: priority ?? 0,
    tags: tags ? JSON.stringify(tags) : null,
    createdBy: authResult.userId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      default: {
        id,
        orgId: org.id,
        key,
        content,
        metadata: metadata ?? null,
        priority: priority ?? 0,
        tags: tags ?? null,
        createdBy: authResult.userId,
        createdAt: now,
        updatedAt: now,
      },
    },
    { status: 201 },
  );
}

/**
 * DELETE /api/v1/org-defaults
 *
 * Delete an org memory default by key.
 * Body: { key: string }
 */
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const org = await resolveOrg(orgSlug);
  if (!org) return jsonError("Organization not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { key } = body as { key?: string };
  if (!key || typeof key !== "string") {
    return jsonError("key is required", 400);
  }

  const [existing] = await db
    .select()
    .from(orgMemoryDefaults)
    .where(
      and(eq(orgMemoryDefaults.orgId, org.id), eq(orgMemoryDefaults.key, key)),
    )
    .limit(1);

  if (!existing) {
    return jsonError("Default not found", 404);
  }

  await db
    .delete(orgMemoryDefaults)
    .where(eq(orgMemoryDefaults.id, existing.id));

  return NextResponse.json({ deleted: true, key });
}
