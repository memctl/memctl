import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { contextTypes, organizations } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { contextTypeUpdateSchema } from "@memctl/shared/validators";

async function resolveOrgAndType(orgSlug: string, slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return null;

  const [contextType] = await db
    .select()
    .from(contextTypes)
    .where(and(eq(contextTypes.orgId, org.id), eq(contextTypes.slug, slug)))
    .limit(1);

  if (!contextType) return null;
  return { org, contextType };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { slug } = await params;
  const orgSlug = req.headers.get("x-org-slug");

  if (!orgSlug) return jsonError("X-Org-Slug header is required", 400);

  const result = await resolveOrgAndType(orgSlug, slug);
  if (!result) return jsonError("Context type not found", 404);

  return NextResponse.json({ contextType: result.contextType });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { slug } = await params;
  const orgSlug = req.headers.get("x-org-slug");

  if (!orgSlug) return jsonError("X-Org-Slug header is required", 400);

  const result = await resolveOrgAndType(orgSlug, slug);
  if (!result) return jsonError("Context type not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = contextTypeUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message, 400);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.label) updates.label = parsed.data.label;
  if (parsed.data.description) updates.description = parsed.data.description;
  if (parsed.data.schema !== undefined)
    updates.schema = parsed.data.schema ?? null;
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon ?? null;

  await db
    .update(contextTypes)
    .set(updates)
    .where(eq(contextTypes.id, result.contextType.id));

  return NextResponse.json({
    contextType: { ...result.contextType, ...updates },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const { slug } = await params;
  const orgSlug = req.headers.get("x-org-slug");

  if (!orgSlug) return jsonError("X-Org-Slug header is required", 400);

  const result = await resolveOrgAndType(orgSlug, slug);
  if (!result) return jsonError("Context type not found", 404);

  await db
    .delete(contextTypes)
    .where(eq(contextTypes.id, result.contextType.id));

  return NextResponse.json({ deleted: true });
}
