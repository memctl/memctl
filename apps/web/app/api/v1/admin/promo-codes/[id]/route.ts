import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  promoCodes,
  promoRedemptions,
  users,
  organizations,
} from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  deactivateStripePromoCode,
  reactivateStripePromoCode,
} from "@/lib/stripe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [code] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);

  if (!code) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch redemption history
  const redemptions = await db
    .select({
      id: promoRedemptions.id,
      orgId: promoRedemptions.orgId,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      userId: promoRedemptions.userId,
      userName: users.name,
      planId: promoRedemptions.planId,
      discountApplied: promoRedemptions.discountApplied,
      redeemedAt: promoRedemptions.redeemedAt,
    })
    .from(promoRedemptions)
    .leftJoin(organizations, eq(promoRedemptions.orgId, organizations.id))
    .leftJoin(users, eq(promoRedemptions.userId, users.id))
    .where(eq(promoRedemptions.promoCodeId, id))
    .orderBy(desc(promoRedemptions.redeemedAt));

  return NextResponse.json({ code, redemptions });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build update object from editable fields only
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.description !== undefined) update.description = body.description;
  if (body.campaign !== undefined) update.campaign = body.campaign;
  if (body.applicablePlans !== undefined)
    update.applicablePlans = body.applicablePlans
      ? JSON.stringify(body.applicablePlans)
      : null;
  if (body.minimumPlanTier !== undefined)
    update.minimumPlanTier = body.minimumPlanTier;
  if (body.restrictedToOrgs !== undefined)
    update.restrictedToOrgs = body.restrictedToOrgs
      ? JSON.stringify(body.restrictedToOrgs)
      : null;
  if (body.maxRedemptions !== undefined)
    update.maxRedemptions = body.maxRedemptions;
  if (body.maxRedemptionsPerOrg !== undefined)
    update.maxRedemptionsPerOrg = body.maxRedemptionsPerOrg;
  if (body.firstSubscriptionOnly !== undefined)
    update.firstSubscriptionOnly = body.firstSubscriptionOnly;
  if (body.noPreviousPromo !== undefined)
    update.noPreviousPromo = body.noPreviousPromo;
  if (body.startsAt !== undefined)
    update.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.expiresAt !== undefined)
    update.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  // Sync active toggle with Stripe
  if (body.active !== undefined && body.active !== existing.active) {
    update.active = body.active;
    try {
      if (body.active) {
        await reactivateStripePromoCode(existing.stripePromoCodeId);
      } else {
        await deactivateStripePromoCode(existing.stripePromoCodeId);
      }
    } catch (err) {
      console.error("Failed to sync active state with Stripe:", err);
      return NextResponse.json(
        { error: "Failed to sync with Stripe" },
        { status: 500 },
      );
    }
  }

  await db.update(promoCodes).set(update).where(eq(promoCodes.id, id));

  const [updated] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);

  return NextResponse.json({ code: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete: deactivate in both DB and Stripe
  try {
    await deactivateStripePromoCode(existing.stripePromoCodeId);
  } catch (err) {
    console.error("Failed to deactivate in Stripe:", err);
  }

  await db
    .update(promoCodes)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(promoCodes.id, id));

  return NextResponse.json({ success: true });
}
