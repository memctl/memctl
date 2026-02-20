import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { sessionLogs } from "@memctl/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { resolveOrgAndProject } from "../memories/capacity-utils";

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

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);

  const logs = await db
    .select()
    .from(sessionLogs)
    .where(eq(sessionLogs.projectId, context.project.id))
    .orderBy(desc(sessionLogs.startedAt))
    .limit(limit);

  return NextResponse.json({ sessionLogs: logs });
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
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body", 400);
  }

  const {
    sessionId,
    branch,
    summary,
    keysRead,
    keysWritten,
    toolsUsed,
    endedAt,
  } = body as {
    sessionId?: string;
    branch?: string;
    summary?: string;
    keysRead?: string[];
    keysWritten?: string[];
    toolsUsed?: string[];
    endedAt?: number;
  };

  if (!sessionId) {
    return jsonError("sessionId is required", 400);
  }

  // Check if session already exists (update if so)
  const [existing] = await db
    .select()
    .from(sessionLogs)
    .where(
      and(
        eq(sessionLogs.projectId, context.project.id),
        eq(sessionLogs.sessionId, sessionId),
      ),
    )
    .limit(1);

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (summary !== undefined) updates.summary = summary;
    if (keysRead !== undefined) updates.keysRead = JSON.stringify(keysRead);
    if (keysWritten !== undefined) updates.keysWritten = JSON.stringify(keysWritten);
    if (toolsUsed !== undefined) updates.toolsUsed = JSON.stringify(toolsUsed);
    if (endedAt !== undefined) updates.endedAt = new Date(endedAt);

    await db.update(sessionLogs).set(updates).where(eq(sessionLogs.id, existing.id));
    return NextResponse.json({ sessionLog: { ...existing, ...updates } });
  }

  const id = generateId();
  const now = new Date();

  await db.insert(sessionLogs).values({
    id,
    projectId: context.project.id,
    sessionId,
    branch: branch ?? null,
    summary: summary ?? null,
    keysRead: keysRead ? JSON.stringify(keysRead) : null,
    keysWritten: keysWritten ? JSON.stringify(keysWritten) : null,
    toolsUsed: toolsUsed ? JSON.stringify(toolsUsed) : null,
    startedAt: now,
    endedAt: endedAt ? new Date(endedAt) : null,
    createdBy: authResult.userId,
  });

  return NextResponse.json(
    { sessionLog: { id, sessionId, projectId: context.project.id, startedAt: now } },
    { status: 201 },
  );
}
