import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { getOrgMemoryCapacity, resolveOrgAndProject } from "../capacity-utils";

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

  const capacity = await getOrgMemoryCapacity(context.org.id, context.org.planId);
  const usageRatio =
    Number.isFinite(capacity.limit) && capacity.limit > 0
      ? Math.min(1, capacity.used / capacity.limit)
      : null;

  return NextResponse.json({
    used: capacity.used,
    limit: capacity.limit,
    isFull: capacity.isFull,
    usageRatio,
  });
}
