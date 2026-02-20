import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, jsonError } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { contextTypes, organizations } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { contextTypeCreateSchema } from "@memctl/shared/validators";

export async function GET(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return jsonError("Organization not found", 404);

  const types = await db
    .select()
    .from(contextTypes)
    .where(eq(contextTypes.orgId, org.id));

  return NextResponse.json({ contextTypes: types });
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return jsonError("X-Org-Slug header is required", 400);
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) return jsonError("Organization not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = contextTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400);
  }

  const { slug, label, description, schema, icon } = parsed.data;

  // Check for duplicate slug
  const [existing] = await db
    .select()
    .from(contextTypes)
    .where(
      eq(contextTypes.orgId, org.id),
    );

  const duplicates = await db
    .select()
    .from(contextTypes)
    .where(eq(contextTypes.orgId, org.id));

  if (duplicates.some((t) => t.slug === slug)) {
    return jsonError(`Context type with slug "${slug}" already exists`, 409);
  }

  const id = generateId();
  const now = new Date();

  await db.insert(contextTypes).values({
    id,
    orgId: org.id,
    slug,
    label,
    description,
    schema: schema ?? null,
    icon: icon ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      contextType: {
        id,
        orgId: org.id,
        slug,
        label,
        description,
        schema: schema ?? null,
        icon: icon ?? null,
        createdAt: now,
        updatedAt: now,
      },
    },
    { status: 201 },
  );
}
