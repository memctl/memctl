import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { promoCodes, promoRedemptions } from "@memctl/db/schema";
import { eq, and, like, desc, asc, count, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { createStripeCouponAndPromoCode } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = req.nextUrl;
  const campaign = url.searchParams.get("campaign");
  const active = url.searchParams.get("active");
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const order = url.searchParams.get("order") ?? "desc";
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const conditions = [];
  if (campaign) conditions.push(eq(promoCodes.campaign, campaign));
  if (active === "true") conditions.push(eq(promoCodes.active, true));
  if (active === "false") conditions.push(eq(promoCodes.active, false));
  if (search) {
    conditions.push(
      sql`(${promoCodes.code} LIKE ${"%" + search + "%"} OR ${promoCodes.description} LIKE ${"%" + search + "%"})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn =
    sort === "code"
      ? promoCodes.code
      : sort === "timesRedeemed"
        ? promoCodes.timesRedeemed
        : sort === "totalDiscountGiven"
          ? promoCodes.totalDiscountGiven
          : promoCodes.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const codes = await db
    .select()
    .from(promoCodes)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ value: count() })
    .from(promoCodes)
    .where(where);

  // Get unique campaigns for filtering
  const campaignRows = await db
    .select({ campaign: promoCodes.campaign })
    .from(promoCodes)
    .where(sql`${promoCodes.campaign} IS NOT NULL`)
    .groupBy(promoCodes.campaign);

  return NextResponse.json({
    codes,
    total: totalResult?.value ?? 0,
    campaigns: campaignRows.map((r) => r.campaign).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    code,
    description,
    campaign,
    discountType,
    discountAmount,
    currency,
    duration,
    durationInMonths,
    applicablePlans,
    minimumPlanTier,
    restrictedToOrgs,
    maxRedemptions,
    maxRedemptionsPerOrg,
    firstSubscriptionOnly,
    noPreviousPromo,
    startsAt,
    expiresAt,
    bulkPrefix,
    bulkCount,
  } = body;

  // Validate required fields
  if (!discountType || !["percent", "fixed"].includes(discountType)) {
    return NextResponse.json({ error: "Invalid discountType" }, { status: 400 });
  }
  if (typeof discountAmount !== "number" || discountAmount <= 0) {
    return NextResponse.json({ error: "Invalid discountAmount" }, { status: 400 });
  }
  if (!duration || !["once", "repeating", "forever"].includes(duration)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  if (duration === "repeating" && (!durationInMonths || durationInMonths < 1)) {
    return NextResponse.json({ error: "durationInMonths required for repeating" }, { status: 400 });
  }

  // Bulk generation
  if (bulkPrefix && bulkCount) {
    if (bulkCount < 2 || bulkCount > 100) {
      return NextResponse.json({ error: "bulkCount must be 2-100" }, { status: 400 });
    }

    const created = [];
    for (let i = 1; i <= bulkCount; i++) {
      const bulkCode = `${bulkPrefix.toUpperCase()}${String(i).padStart(3, "0")}`;

      // Check uniqueness
      const [existing] = await db
        .select({ id: promoCodes.id })
        .from(promoCodes)
        .where(eq(promoCodes.code, bulkCode))
        .limit(1);
      if (existing) continue;

      try {
        const stripeResult = await createStripeCouponAndPromoCode({
          code: bulkCode,
          discountType,
          discountAmount,
          currency,
          duration,
          durationInMonths,
          maxRedemptions,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          firstSubscriptionOnly,
        });

        const id = generateId();
        await db.insert(promoCodes).values({
          id,
          code: bulkCode,
          description,
          campaign,
          stripeCouponId: stripeResult.couponId,
          stripePromoCodeId: stripeResult.promoCodeId,
          discountType,
          discountAmount,
          currency: currency ?? "usd",
          duration,
          durationInMonths,
          applicablePlans: applicablePlans ? JSON.stringify(applicablePlans) : null,
          minimumPlanTier,
          restrictedToOrgs: restrictedToOrgs ? JSON.stringify(restrictedToOrgs) : null,
          maxRedemptions,
          maxRedemptionsPerOrg: maxRedemptionsPerOrg ?? 1,
          firstSubscriptionOnly: firstSubscriptionOnly ?? false,
          noPreviousPromo: noPreviousPromo ?? false,
          startsAt: startsAt ? new Date(startsAt) : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: session.user.id,
        });

        created.push({ id, code: bulkCode });
      } catch (err) {
        console.error(`Failed to create bulk code ${bulkCode}:`, err);
      }
    }

    return NextResponse.json({ created, count: created.length });
  }

  // Single code creation
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!normalizedCode) {
    return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
  }

  // Check uniqueness
  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, normalizedCode))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Code already exists" }, { status: 409 });
  }

  try {
    const stripeResult = await createStripeCouponAndPromoCode({
      code: normalizedCode,
      discountType,
      discountAmount,
      currency,
      duration,
      durationInMonths,
      maxRedemptions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      firstSubscriptionOnly,
    });

    const id = generateId();
    await db.insert(promoCodes).values({
      id,
      code: normalizedCode,
      description,
      campaign,
      stripeCouponId: stripeResult.couponId,
      stripePromoCodeId: stripeResult.promoCodeId,
      discountType,
      discountAmount,
      currency: currency ?? "usd",
      duration,
      durationInMonths,
      applicablePlans: applicablePlans ? JSON.stringify(applicablePlans) : null,
      minimumPlanTier,
      restrictedToOrgs: restrictedToOrgs ? JSON.stringify(restrictedToOrgs) : null,
      maxRedemptions,
      maxRedemptionsPerOrg: maxRedemptionsPerOrg ?? 1,
      firstSubscriptionOnly: firstSubscriptionOnly ?? false,
      noPreviousPromo: noPreviousPromo ?? false,
      startsAt: startsAt ? new Date(startsAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: session.user.id,
    });

    return NextResponse.json({ id, code: normalizedCode }, { status: 201 });
  } catch (err) {
    console.error("Failed to create promo code:", err);
    return NextResponse.json(
      { error: "Failed to create promo code in Stripe" },
      { status: 500 },
    );
  }
}
