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

  const capacity = await getOrgMemoryCapacity(
    context.org.id,
    context.org.planId,
    context.project.id,
  );

  return NextResponse.json({
    used: capacity.used,
    limit: capacity.limit,
    orgUsed: capacity.orgUsed,
    orgLimit: capacity.orgLimit,
    isFull: capacity.isFull,
    isSoftFull: capacity.isSoftFull,
    isApproaching: capacity.isApproaching,
    usageRatio: capacity.usageRatio,
  });
}
