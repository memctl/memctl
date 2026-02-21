import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { memories } from "@memctl/db/schema";
import { eq, and, isNull, like } from "drizzle-orm";
import { resolveOrgAndProject } from "../capacity-utils";

/**
 * GET /api/v1/memories/export?format=agents_md|cursorrules|json
 *
 * Export structured agent context memories back to flat file formats.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");

  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveOrgAndProject(orgSlug, projectSlug, authResult.userId);
  if (!context) return jsonError("Project not found", 404);

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "agents_md";

  // Get all agent context memories
  const contextMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.projectId, context.project.id),
        like(memories.key, "agent/context/%"),
        isNull(memories.archivedAt),
      ),
    );

  // Group by type
  const byType: Record<string, Array<{ key: string; content: string; metadata: Record<string, unknown> | null; priority: number }>> = {};

  for (const mem of contextMemories) {
    const parts = mem.key.split("/");
    if (parts.length !== 4) continue;
    const type = parts[2];
    if (!byType[type]) byType[type] = [];

    let parsed: Record<string, unknown> | null = null;
    if (mem.metadata) {
      try { parsed = JSON.parse(mem.metadata) as Record<string, unknown>; } catch { /* ignore */ }
    }

    byType[type].push({
      key: mem.key,
      content: mem.content,
      metadata: parsed,
      priority: mem.priority ?? 0,
    });
  }

  // Sort entries within each type by priority desc
  for (const entries of Object.values(byType)) {
    entries.sort((a, b) => b.priority - a.priority);
  }

  const typeLabels: Record<string, string> = {
    coding_style: "Coding Style",
    folder_structure: "Folder Structure",
    file_map: "File Map",
    architecture: "Architecture",
    workflow: "Workflow",
    testing: "Testing",
    branch_plan: "Branch Plan",
    constraints: "Constraints",
    lessons_learned: "Lessons Learned",
  };

  if (format === "json") {
    return NextResponse.json({ types: byType });
  }

  if (format === "cursorrules") {
    // Export as .cursorrules format (flat rules, one per line)
    const lines: string[] = [];
    for (const [type, entries] of Object.entries(byType)) {
      if (type === "branch_plan") continue;
      lines.push(`# ${typeLabels[type] ?? type}`);
      lines.push("");
      for (const entry of entries) {
        lines.push(entry.content);
        lines.push("");
      }
    }
    return new NextResponse(lines.join("\n"), {
      headers: { "Content-Type": "text/plain", "Content-Disposition": "attachment; filename=.cursorrules" },
    });
  }

  // Default: agents_md format
  const sections: string[] = [];
  sections.push("# AGENTS.md");
  sections.push("");
  sections.push("> Auto-generated from memctl structured agent context");
  sections.push("");

  for (const [type, entries] of Object.entries(byType)) {
    if (type === "branch_plan") continue;
    const label = typeLabels[type] ?? type;
    sections.push(`## ${label}`);
    sections.push("");
    for (const entry of entries) {
      const title = typeof entry.metadata?.title === "string" ? entry.metadata.title : null;
      if (title && entries.length > 1) {
        sections.push(`### ${title}`);
        sections.push("");
      }
      sections.push(entry.content);
      sections.push("");
    }
  }

  const markdown = sections.join("\n");
  return new NextResponse(markdown, {
    headers: { "Content-Type": "text/markdown", "Content-Disposition": "attachment; filename=AGENTS.md" },
  });
}
