import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  promoCodes,
} from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { createCheckoutSession, STRIPE_PLANS } from "@/lib/stripe";
import { isBillingEnabled } from "@/lib/plans";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  // Verify owner or admin
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "member") {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const planId = body?.planId;
  const promoCode = body?.promoCode;

  if (!planId || !STRIPE_PLANS[planId]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!org.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
  }

  // Resolve promo code to Stripe promotion code ID
  let stripePromoCodeId: string | undefined;
  if (promoCode) {
    const [promo] = await db
      .select()
      .from(promoCodes)
      .where(
        and(
          eq(promoCodes.code, promoCode.toUpperCase()),
          eq(promoCodes.active, true),
        ),
      )
      .limit(1);
    if (promo) {
      stripePromoCodeId = promo.stripePromoCodeId;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await createCheckoutSession({
    customerId: org.stripeCustomerId,
    priceId: STRIPE_PLANS[planId].priceId,
    orgSlug: slug,
    successUrl: `${appUrl}/org/${slug}/billing?success=true`,
    cancelUrl: `${appUrl}/org/${slug}/billing?canceled=true`,
    stripePromoCodeId,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
