import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  promoCodes,
  promoRedemptions,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { headers } from "next/headers";
import { PLAN_IDS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";

const PLAN_TIER_ORDER: PlanId[] = ["free", "lite", "pro", "business", "scale", "enterprise"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const code = body?.code?.toUpperCase()?.trim();
  const planId = body?.planId;

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Verify org membership
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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // 1. Code exists and active
  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);

  if (!promo || !promo.active) {
    return NextResponse.json({
      valid: false,
      reason: "Invalid promo code",
    });
  }

  const now = new Date();

  // 2. startsAt check
  if (promo.startsAt && now < promo.startsAt) {
    return NextResponse.json({
      valid: false,
      reason: "This code is not active yet",
    });
  }

  // 3. expiresAt check
  if (promo.expiresAt && now > promo.expiresAt) {
    return NextResponse.json({
      valid: false,
      reason: "This code has expired",
    });
  }

  // 4. maxRedemptions check
  if (promo.maxRedemptions !== null && promo.timesRedeemed >= promo.maxRedemptions) {
    return NextResponse.json({
      valid: false,
      reason: "This code has reached its usage limit",
    });
  }

  // 5. maxRedemptionsPerOrg check
  if (promo.maxRedemptionsPerOrg !== null) {
    const [orgRedemptionCount] = await db
      .select({ value: count() })
      .from(promoRedemptions)
      .where(
        and(
          eq(promoRedemptions.promoCodeId, promo.id),
          eq(promoRedemptions.orgId, org.id),
        ),
      );
    if ((orgRedemptionCount?.value ?? 0) >= promo.maxRedemptionsPerOrg) {
      return NextResponse.json({
        valid: false,
        reason: "Already used by your organization",
      });
    }
  }

  // 6. restrictedToOrgs check
  if (promo.restrictedToOrgs) {
    const allowedOrgs: string[] = JSON.parse(promo.restrictedToOrgs);
    if (!allowedOrgs.includes(org.id)) {
      return NextResponse.json({
        valid: false,
        reason: "This code is not available for your organization",
      });
    }
  }

  // 7. applicablePlans check
  if (planId && promo.applicablePlans) {
    const allowedPlans: string[] = JSON.parse(promo.applicablePlans);
    if (!allowedPlans.includes(planId)) {
      return NextResponse.json({
        valid: false,
        reason: "Not valid for this plan",
      });
    }
  }

  // 8. minimumPlanTier check
  if (planId && promo.minimumPlanTier) {
    const minTierIndex = PLAN_TIER_ORDER.indexOf(promo.minimumPlanTier as PlanId);
    const selectedTierIndex = PLAN_TIER_ORDER.indexOf(planId as PlanId);
    if (selectedTierIndex >= 0 && minTierIndex >= 0 && selectedTierIndex < minTierIndex) {
      return NextResponse.json({
        valid: false,
        reason: "Requires a higher plan tier",
      });
    }
  }

  // 9. firstSubscriptionOnly check
  if (promo.firstSubscriptionOnly && org.stripeSubscriptionId) {
    return NextResponse.json({
      valid: false,
      reason: "Only valid for first subscription",
    });
  }

  // 10. noPreviousPromo check
  if (promo.noPreviousPromo) {
    const [prevPromo] = await db
      .select({ value: count() })
      .from(promoRedemptions)
      .where(eq(promoRedemptions.orgId, org.id));
    if ((prevPromo?.value ?? 0) > 0) {
      return NextResponse.json({
        valid: false,
        reason: "Only valid for organizations that haven't used a promo code before",
      });
    }
  }

  return NextResponse.json({
    valid: true,
    discount: {
      type: promo.discountType,
      amount: promo.discountAmount,
      currency: promo.currency,
      duration: promo.duration,
      durationInMonths: promo.durationInMonths,
    },
    stripePromoCodeId: promo.stripePromoCodeId,
  });
}
