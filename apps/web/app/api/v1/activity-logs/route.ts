import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { activityLogs } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
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
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const sessionId = url.searchParams.get("session_id");

  let query = db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.projectId, context.project.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  if (sessionId) {
    query = db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.sessionId, sessionId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  const logs = await query;
  return NextResponse.json({ activityLogs: logs });
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

  const { action, sessionId, toolName, memoryKey, details } = body as {
    action: string;
    sessionId?: string;
    toolName?: string;
    memoryKey?: string;
    details?: Record<string, unknown>;
  };

  if (!action) {
    return jsonError("action is required", 400);
  }

  const id = generateId();
  await db.insert(activityLogs).values({
    id,
    projectId: context.project.id,
    sessionId: sessionId ?? null,
    action,
    toolName: toolName ?? null,
    memoryKey: memoryKey ?? null,
    details: details ? JSON.stringify(details) : null,
    createdBy: authResult.userId,
    createdAt: new Date(),
  });

  return NextResponse.json({ activityLog: { id, action } }, { status: 201 });
}
