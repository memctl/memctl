import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  organizations,
  organizationMembers,
  onboardingResponses,
} from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { onboardingSchema } from "@memctl/shared/validators";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { heardFrom, role, teamSize, useCase, orgName, orgSlug } = parsed.data;

  // Check slug uniqueness
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Organization slug already taken" },
      { status: 409 },
    );
  }

  const now = new Date();

  // Save onboarding responses
  await db.insert(onboardingResponses).values({
    id: generateId(),
    userId: session.user.id,
    heardFrom,
    role,
    teamSize,
    useCase,
    createdAt: now,
  });

  // Create Stripe customer (skip if Stripe is not configured)
  let stripeCustomerId: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: orgName,
      metadata: { orgSlug },
    });
    stripeCustomerId = customer.id;
  }

  // Create org
  const orgId = generateId();
  await db.insert(organizations).values({
    id: orgId,
    name: orgName,
    slug: orgSlug,
    ownerId: session.user.id,
    planId: "free",
    stripeCustomerId,
    projectLimit: 2,
    memberLimit: 2,
    createdAt: now,
    updatedAt: now,
  });

  // Add user as owner
  await db.insert(organizationMembers).values({
    id: generateId(),
    orgId,
    userId: session.user.id,
    role: "owner",
    createdAt: now,
  });

  // Mark onboarding as complete
  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: now })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true, orgSlug }, { status: 201 });
}
