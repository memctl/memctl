import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { webhookConfigs, organizations, projects } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { PLANS, type PlanId, PLAN_IDS } from "@memctl/shared/constants";

function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

async function resolveContext(orgSlug: string, projectSlug: string) {
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
  if (!project) return null;

  return { org, project };
}

/**
 * GET /api/v1/webhooks - List webhook configs
 * POST /api/v1/webhooks - Create a digest webhook (paid plans only)
 * DELETE /api/v1/webhooks - Delete a webhook config
 *
 * Digest webhooks batch changes and send at most once per interval.
 * Minimum interval: 60 minutes. This prevents noisy per-change notifications.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");
  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveContext(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const configs = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.projectId, context.project.id));

  return NextResponse.json({ webhooks: configs });
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");
  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveContext(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  // Check paid plan
  const planId = isPlanId(context.org.planId) ? context.org.planId : "free";
  const plan = PLANS[planId];
  if (planId === "free" || !plan) {
    return jsonError("Digest webhooks are available on paid plans only. Upgrade to use this feature.", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string") {
    return jsonError("Body must have url (string)", 400);
  }

  const { url, events, digestIntervalMinutes, secret } = body as {
    url: string;
    events?: string[];
    digestIntervalMinutes?: number;
    secret?: string;
  };

  // Enforce minimum interval of 60 minutes
  const interval = Math.max(60, digestIntervalMinutes ?? 60);

  const id = generateId();
  await db.insert(webhookConfigs).values({
    id,
    projectId: context.project.id,
    url,
    events: events ? JSON.stringify(events) : null,
    digestIntervalMinutes: interval,
    secret: secret ?? null,
    createdAt: new Date(),
  });

  return NextResponse.json(
    {
      webhook: {
        id,
        url,
        events: events ?? null,
        digestIntervalMinutes: interval,
        isActive: true,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  const projectSlug = req.headers.get("x-project-slug");
  if (!orgSlug || !projectSlug) {
    return jsonError("X-Org-Slug and X-Project-Slug headers are required", 400);
  }

  const context = await resolveContext(orgSlug, projectSlug);
  if (!context) return jsonError("Project not found", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.webhookId !== "string") {
    return jsonError("Body must have webhookId (string)", 400);
  }

  await db
    .delete(webhookConfigs)
    .where(
      and(
        eq(webhookConfigs.id, body.webhookId),
        eq(webhookConfigs.projectId, context.project.id),
      ),
    );

  return NextResponse.json({ deleted: true, webhookId: body.webhookId });
}
