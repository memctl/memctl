import { db } from "@/lib/db";
import { stripe, STRIPE_EXTRA_SEAT_PRICE_ID } from "@/lib/stripe";
import { isBillingEnabled, isSelfHosted } from "@/lib/plans";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { PLANS, type PlanId } from "@memctl/shared/constants";
import { count, eq } from "drizzle-orm";

const PAID_SEAT_PLANS: PlanId[] = ["lite", "pro", "business", "scale"];

export async function getOrgMemberCount(orgId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId));
  return row?.value ?? 0;
}

function getBaseIncludedSeats(planId: string): number | null {
  if (!PAID_SEAT_PLANS.includes(planId as PlanId)) return null;
  const plan = PLANS[planId as PlanId];
  if (!plan || plan.memberLimit === Infinity) return null;
  return plan.memberLimit;
}

async function upsertExtraSeatQuantity(
  subscriptionId: string,
  quantity: number,
): Promise<void> {
  if (!STRIPE_EXTRA_SEAT_PRICE_ID) {
    throw new Error("Missing STRIPE_EXTRA_SEAT_PRICE_ID");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const existingItem = subscription.items.data.find(
    (item) => item.price.id === STRIPE_EXTRA_SEAT_PRICE_ID,
  );

  if (quantity <= 0) {
    if (existingItem) {
      await stripe.subscriptionItems.del(existingItem.id, {
        proration_behavior: "create_prorations",
      });
    }
    return;
  }

  if (existingItem) {
    await stripe.subscriptionItems.update(existingItem.id, {
      quantity,
      proration_behavior: "create_prorations",
    });
    return;
  }

  await stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: STRIPE_EXTRA_SEAT_PRICE_ID,
    quantity,
    proration_behavior: "create_prorations",
  });
}

export async function ensureSeatForAdditionalMember(
  orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [org] = await db
    .select({
      id: organizations.id,
      planId: organizations.planId,
      memberLimit: organizations.memberLimit,
      stripeSubscriptionId: organizations.stripeSubscriptionId,
      customLimits: organizations.customLimits,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return { ok: false, error: "Organization not found" };

  const currentMembers = await getOrgMemberCount(orgId);
  const requiredMemberCapacity = currentMembers + 1;
  if (requiredMemberCapacity <= org.memberLimit) return { ok: true };

  if (isSelfHosted()) {
    return { ok: false, error: "Member limit reached for this organization" };
  }

  if (!isBillingEnabled()) {
    return { ok: false, error: "Billing is not enabled" };
  }

  if (!STRIPE_EXTRA_SEAT_PRICE_ID) {
    return {
      ok: false,
      error:
        "Extra seat billing is not configured. Set STRIPE_EXTRA_SEAT_PRICE_ID.",
    };
  }

  if (org.customLimits) {
    return {
      ok: false,
      error:
        "Member limit reached. This organization uses custom limits, add seats in admin.",
    };
  }

  if (!org.stripeSubscriptionId) {
    return {
      ok: false,
      error: "Member limit reached. Start a paid subscription to add seats.",
    };
  }

  const baseIncludedSeats = getBaseIncludedSeats(org.planId);
  if (!baseIncludedSeats) {
    return { ok: false, error: "Current plan does not support extra seats" };
  }

  const requiredExtraSeats = Math.max(
    0,
    requiredMemberCapacity - baseIncludedSeats,
  );

  await upsertExtraSeatQuantity(org.stripeSubscriptionId, requiredExtraSeats);

  await db
    .update(organizations)
    .set({
      memberLimit: baseIncludedSeats + requiredExtraSeats,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));

  return { ok: true };
}

export async function syncSeatQuantityToMemberCount(orgId: string): Promise<void> {
  if (isSelfHosted() || !isBillingEnabled() || !STRIPE_EXTRA_SEAT_PRICE_ID) {
    return;
  }

  const [org] = await db
    .select({
      id: organizations.id,
      planId: organizations.planId,
      stripeSubscriptionId: organizations.stripeSubscriptionId,
      customLimits: organizations.customLimits,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org || org.customLimits || !org.stripeSubscriptionId) return;

  const baseIncludedSeats = getBaseIncludedSeats(org.planId);
  if (!baseIncludedSeats) return;

  const memberCount = await getOrgMemberCount(org.id);
  const requiredExtraSeats = Math.max(0, memberCount - baseIncludedSeats);

  await upsertExtraSeatQuantity(org.stripeSubscriptionId, requiredExtraSeats);

  await db
    .update(organizations)
    .set({
      memberLimit: baseIncludedSeats + requiredExtraSeats,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, org.id));
}
