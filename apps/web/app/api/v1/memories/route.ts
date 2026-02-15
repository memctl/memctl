import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import {
  memories,
  projects,
  organizations,
} from "@memctl/db/schema";
import { eq, and, like } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { memoryStoreSchema } from "@memctl/shared/validators";

async function resolveProject(orgSlug: string, projectSlug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  return project ?? null;
}

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const project = await resolveProject(orgSlug, projectSlug);
  if (!project) {
    return jsonError("Project not found", 404);
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let results;
  if (query) {
    results = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, project.id),
          like(memories.key, `%${query}%`),
        ),
      )
      .limit(limit)
      .offset(offset);

    // Also search content
    const contentResults = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, project.id),
          like(memories.content, `%${query}%`),
        ),
      )
      .limit(limit);

    // Merge and deduplicate
    const seen = new Set(results.map((r) => r.id));
    for (const r of contentResults) {
      if (!seen.has(r.id)) {
        results.push(r);
        seen.add(r.id);
      }
    }
    results = results.slice(0, limit);
  } else {
    results = await db
      .select()
      .from(memories)
      .where(eq(memories.projectId, project.id))
      .limit(limit)
      .offset(offset);
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

  const project = await resolveProject(orgSlug, projectSlug);
  if (!project) {
    return jsonError("Project not found", 404);
  }

  const body = await req.json().catch(() => null);
  const parsed = memoryStoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { key, content, metadata } = parsed.data;

  // Upsert: update if exists, create if not
  const [existing] = await db
    .select()
    .from(memories)
    .where(
      and(eq(memories.projectId, project.id), eq(memories.key, key)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(memories)
      .set({
        content,
        metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
        updatedAt: new Date(),
      })
      .where(eq(memories.id, existing.id));

    return NextResponse.json({ memory: { ...existing, content, updatedAt: new Date() } });
  }

  const id = generateId();
  const now = new Date();
  await db.insert(memories).values({
    id,
    projectId: project.id,
    key,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdBy: authResult.userId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      memory: {
        id,
        projectId: project.id,
        key,
        content,
        metadata: metadata ?? null,
        createdBy: authResult.userId,
        createdAt: now,
        updatedAt: now,
      },
    },
    { status: 201 },
  );
}
