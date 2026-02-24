import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { orgCreateSchema } from "@memctl/shared/validators";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import {
  getOrgCreationLimits,
  isBillingEnabled,
  isSelfHosted,
  FREE_ORG_LIMIT_PER_USER,
} from "@/lib/plans";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id));

  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) {
    return NextResponse.json({ organizations: [] });
  }

  const orgs = await Promise.all(
    orgIds.map(async (orgId) => {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      return org;
    }),
  );

  return NextResponse.json({
    organizations: orgs.filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Self-hosted: single org only (created via dev bypass)
  if (isSelfHosted()) {
    return NextResponse.json(
      { error: "Organization creation is disabled in self-hosted mode" },
      { status: 403 },
    );
  }

  // Free org limit: max N free-plan orgs per user (paid orgs don't count)
  const ownedOrgs = await db
    .select({ planId: organizations.planId })
    .from(organizations)
    .where(eq(organizations.ownerId, session.user.id));

  const freeOwnedCount = ownedOrgs.filter((o) => o.planId === "free").length;

  if (freeOwnedCount >= FREE_ORG_LIMIT_PER_USER) {
    return NextResponse.json(
      {
        error:
          "Free organization limit reached. Upgrade an existing organization or contact support.",
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = orgCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Check slug uniqueness
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Organization slug already taken" },
      { status: 409 },
    );
  }

  // Create Stripe customer (skip if billing is disabled)
  let stripeCustomerId: string | null = null;
  if (isBillingEnabled()) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: parsed.data.name,
      metadata: { orgSlug: parsed.data.slug },
    });
    stripeCustomerId = customer.id;
  }

  const orgId = generateId();
  const now = new Date();

  await db.insert(organizations).values({
    id: orgId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    ownerId: session.user.id,
    ...getOrgCreationLimits(),
    stripeCustomerId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(organizationMembers).values({
    id: generateId(),
    orgId,
    userId: session.user.id,
    role: "owner",
    createdAt: now,
  });

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return NextResponse.json({ organization: org }, { status: 201 });
}
