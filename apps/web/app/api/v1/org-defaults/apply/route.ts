import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import {
  memories,
  memoryVersions,
  orgMemoryDefaults,
  organizations,
  projects,
} from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";

/**
 * POST /api/v1/org-defaults/apply
 *
 * Apply all org defaults to a specific project.
 * Existing memories with the same key are updated, new ones are created.
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return jsonError("Organization not found", 404);

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!project) return jsonError("Project not found", 404);

  // Get all org defaults
  const defaults = await db
    .select()
    .from(orgMemoryDefaults)
    .where(eq(orgMemoryDefaults.orgId, org.id));

  if (defaults.length === 0) {
    return NextResponse.json({
      applied: true,
      memoriesCreated: 0,
      memoriesUpdated: 0,
      message: "No org defaults to apply.",
    });
  }

  let memoriesCreated = 0;
  let memoriesUpdated = 0;

  for (const def of defaults) {
    const [existing] = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.projectId, project.id),
          eq(memories.key, def.key),
        ),
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
        content: def.content,
        updatedAt: new Date(),
      };
      if (def.metadata !== null) updates.metadata = def.metadata;
      if (def.priority !== null) updates.priority = def.priority;
      if (def.tags !== null) updates.tags = def.tags;
      if (existing.archivedAt) updates.archivedAt = null;

      await db
        .update(memories)
        .set(updates)
        .where(eq(memories.id, existing.id));

      memoriesUpdated++;
    } else {
      const id = generateId();
      const now = new Date();

      await db.insert(memories).values({
        id,
        projectId: project.id,
        key: def.key,
        content: def.content,
        metadata: def.metadata,
        scope: "project",
        priority: def.priority ?? 0,
        tags: def.tags,
        createdBy: authResult.userId,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(memoryVersions).values({
        id: generateId(),
        memoryId: id,
        version: 1,
        content: def.content,
        metadata: def.metadata,
        changedBy: authResult.userId,
        changeType: "created",
        createdAt: now,
      });

      memoriesCreated++;
    }
  }

  return NextResponse.json({
    applied: true,
    memoriesCreated,
    memoriesUpdated,
    totalDefaults: defaults.length,
  });
}
