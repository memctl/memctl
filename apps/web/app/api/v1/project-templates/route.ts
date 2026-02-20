import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories, memoryVersions, projectTemplates } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../memories/capacity-utils";

interface TemplateEntry {
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
  priority?: number;
  tags?: string[];
}

/**
 * GET /api/v1/project-templates
 *
 * List all project templates for the org.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const templates = await db
    .select()
    .from(projectTemplates)
    .where(eq(projectTemplates.orgId, context.org.id))
    .orderBy(desc(projectTemplates.createdAt));

  // Parse the data field for each template before returning
  const parsed = templates.map((t) => ({
    ...t,
    data: JSON.parse(t.data) as TemplateEntry[],
  }));

  return NextResponse.json({ templates: parsed });
}

/**
 * POST /api/v1/project-templates
 *
 * Create a new template OR apply an existing template to the project.
 *
 * Create: { name, description?, data: Array<{key, content, metadata?, priority?, tags?}> }
 * Apply:  { apply: true, templateId: string }
 */
export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  // --- Apply existing template ---
  if (body.apply === true) {
    const { templateId } = body as { templateId?: string };
    if (!templateId || typeof templateId !== "string") {
      return jsonError("templateId is required when apply is true", 400);
    }

    const [template] = await db
      .select()
      .from(projectTemplates)
      .where(
        and(
          eq(projectTemplates.id, templateId),
          eq(projectTemplates.orgId, context.org.id),
        ),
      )
      .limit(1);

    if (!template) {
      return jsonError("Template not found", 404);
    }

    let entries: TemplateEntry[];
    try {
      entries = JSON.parse(template.data) as TemplateEntry[];
    } catch {
      return jsonError("Template data is corrupted", 500);
    }

    let memoriesCreated = 0;
    let memoriesUpdated = 0;

    for (const entry of entries) {
      const [existing] = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.projectId, context.project.id),
            eq(memories.key, entry.key),
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
          content: entry.content,
          updatedAt: new Date(),
        };
        if (entry.metadata !== undefined) updates.metadata = JSON.stringify(entry.metadata);
        if (entry.priority !== undefined) updates.priority = entry.priority;
        if (entry.tags !== undefined) updates.tags = JSON.stringify(entry.tags);

        // Unarchive if re-storing an archived memory
        if (existing.archivedAt) {
          updates.archivedAt = null;
        }

        await db
          .update(memories)
          .set(updates)
          .where(eq(memories.id, existing.id));

        memoriesUpdated++;
      } else {
        // Create new memory
        const id = generateId();
        const now = new Date();

        await db.insert(memories).values({
          id,
          projectId: context.project.id,
          key: entry.key,
          content: entry.content,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          scope: "project",
          priority: entry.priority ?? 0,
          tags: entry.tags ? JSON.stringify(entry.tags) : null,
          createdBy: authResult.userId,
          createdAt: now,
          updatedAt: now,
        });

        // Create initial version
        await db.insert(memoryVersions).values({
          id: generateId(),
          memoryId: id,
          version: 1,
          content: entry.content,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          changedBy: authResult.userId,
          changeType: "created",
          createdAt: now,
        });

        memoriesCreated++;
      }
    }

    return NextResponse.json({
      applied: true,
      templateName: template.name,
      memoriesCreated,
      memoriesUpdated,
    });
  }

  // --- Create new template ---
  const { name, description, data } = body as {
    name?: string;
    description?: string;
    data?: TemplateEntry[];
  };

  if (!name || typeof name !== "string") {
    return jsonError("name is required", 400);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return jsonError("data must be a non-empty array of template entries", 400);
  }

  // Validate each entry has at least key and content
  for (const entry of data) {
    if (!entry.key || typeof entry.key !== "string") {
      return jsonError("Each template entry must have a key (string)", 400);
    }
    if (!entry.content || typeof entry.content !== "string") {
      return jsonError("Each template entry must have content (string)", 400);
    }
  }

  const id = generateId();
  const now = new Date();

  await db.insert(projectTemplates).values({
    id,
    orgId: context.org.id,
    name,
    description: description ?? null,
    data: JSON.stringify(data),
    createdBy: authResult.userId,
    createdAt: now,
  });

  return NextResponse.json(
    {
      template: {
        id,
        orgId: context.org.id,
        name,
        description: description ?? null,
        data,
        createdBy: authResult.userId,
        createdAt: now,
      },
    },
    { status: 201 },
  );
}

/**
 * DELETE /api/v1/project-templates
 *
 * Delete a template by ID. Body: { templateId: string }
 * Ensures the template belongs to the org before deletion.
 */
export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const { templateId } = body as { templateId?: string };
  if (!templateId || typeof templateId !== "string") {
    return jsonError("templateId is required", 400);
  }

  // Ensure the template belongs to the org
  const [template] = await db
    .select()
    .from(projectTemplates)
    .where(
      and(
        eq(projectTemplates.id, templateId),
        eq(projectTemplates.orgId, context.org.id),
      ),
    )
    .limit(1);

  if (!template) {
    return jsonError("Template not found", 404);
  }

  await db
    .delete(projectTemplates)
    .where(eq(projectTemplates.id, templateId));

  return NextResponse.json({ deleted: true, templateId });
}
