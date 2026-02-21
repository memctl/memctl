import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { promoCodes } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { createStripeCouponAndPromoCode } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const newCode = body?.code?.toUpperCase()?.replace(/[^A-Z0-9-]/g, "");

  if (!newCode) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const [source] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Check uniqueness
  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, newCode))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Code already exists" }, { status: 409 });
  }

  try {
    const stripeResult = await createStripeCouponAndPromoCode({
      code: newCode,
      discountType: source.discountType as "percent" | "fixed",
      discountAmount: source.discountAmount,
      currency: source.currency ?? "usd",
      duration: source.duration as "once" | "repeating" | "forever",
      durationInMonths: source.durationInMonths ?? undefined,
      maxRedemptions: source.maxRedemptions ?? undefined,
      expiresAt: source.expiresAt ?? undefined,
      firstSubscriptionOnly: source.firstSubscriptionOnly ?? false,
    });

    const newId = generateId();
    await db.insert(promoCodes).values({
      id: newId,
      code: newCode,
      description: source.description,
      campaign: source.campaign,
      stripeCouponId: stripeResult.couponId,
      stripePromoCodeId: stripeResult.promoCodeId,
      discountType: source.discountType,
      discountAmount: source.discountAmount,
      currency: source.currency,
      duration: source.duration,
      durationInMonths: source.durationInMonths,
      applicablePlans: source.applicablePlans,
      minimumPlanTier: source.minimumPlanTier,
      restrictedToOrgs: source.restrictedToOrgs,
      maxRedemptions: source.maxRedemptions,
      maxRedemptionsPerOrg: source.maxRedemptionsPerOrg,
      firstSubscriptionOnly: source.firstSubscriptionOnly,
      noPreviousPromo: source.noPreviousPromo,
      startsAt: source.startsAt,
      expiresAt: source.expiresAt,
      createdBy: session.user.id,
    });

    return NextResponse.json({ id: newId, code: newCode }, { status: 201 });
  } catch (err) {
    console.error("Failed to clone promo code:", err);
    return NextResponse.json(
      { error: "Failed to create cloned code in Stripe" },
      { status: 500 },
    );
  }
}
