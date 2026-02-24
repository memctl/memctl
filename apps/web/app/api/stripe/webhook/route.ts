import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_EXTRA_SEAT_PRICE_ID } from "@/lib/stripe";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  promoCodes,
  promoRedemptions,
} from "@memctl/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { PLAN_IDS, PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { clampLimit, isBillingEnabled } from "@/lib/plans";
import { generateId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 400 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook error: ${message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgSlug = session.metadata?.orgSlug;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId = getCustomerId(session.customer);

      if (orgSlug && subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const planId =
          getPlanFromSubscription(subscription) ??
          getPlanFromMetadata(session.metadata);
        const extraSeatQuantity = getExtraSeatQuantityFromSubscription(
          subscription,
        );

        if (planId) {
          const [existingOrg] = await db
            .select({
              id: organizations.id,
              customLimits: organizations.customLimits,
            })
            .from(organizations)
            .where(eq(organizations.slug, orgSlug))
            .limit(1);

          const isManagedEntitlement = isEntitlementManaged(subscription);
          const updateValues: Record<string, unknown> = {
            stripeSubscriptionId: subscriptionId,
            planId,
            updatedAt: new Date(),
          };
          if (isManagedEntitlement) {
            updateValues.planOverride = planId;
            updateValues.trialEndsAt = null;
            updateValues.planExpiresAt = null;
          }

          if (!existingOrg?.customLimits) {
            const plan = PLANS[planId];
            updateValues.projectLimit = clampLimit(plan.projectLimit);
            updateValues.memberLimit = clampLimit(
              plan.memberLimit + extraSeatQuantity,
            );
            updateValues.memoryLimitPerProject = null;
            updateValues.memoryLimitOrg = null;
            updateValues.apiRatePerMinute = null;
            updateValues.customLimits = false;
          }

          if (existingOrg) {
            await db
              .update(organizations)
              .set(updateValues)
              .where(eq(organizations.id, existingOrg.id));
            await enforceSeatComplianceStatus(existingOrg.id);
          }
        }

        // Track promo code redemption
        try {
          const totalDiscount = session.total_details?.amount_discount ?? 0;
          // Check if a promotion code was applied via discounts
          const sessionAny = session as unknown as Record<string, unknown>;
          const discountObjs = sessionAny.discounts as
            | Array<{ promotion_code?: string }>
            | undefined;
          const appliedPromoCodeId =
            discountObjs?.[0]?.promotion_code ??
            (typeof sessionAny.discount === "object" &&
            sessionAny.discount !== null
              ? (sessionAny.discount as { promotion_code?: string })
                  .promotion_code
              : undefined);

          if (appliedPromoCodeId && typeof appliedPromoCodeId === "string") {
            const [promo] = await db
              .select()
              .from(promoCodes)
              .where(eq(promoCodes.stripePromoCodeId, appliedPromoCodeId))
              .limit(1);

            if (promo) {
              const [org] = await db
                .select()
                .from(organizations)
                .where(eq(organizations.slug, orgSlug))
                .limit(1);

              if (org) {
                await db.insert(promoRedemptions).values({
                  id: generateId(),
                  promoCodeId: promo.id,
                  orgId: org.id,
                  userId: session.metadata?.userId ?? org.ownerId,
                  planId: planId ?? org.planId,
                  discountApplied: totalDiscount,
                  stripeCheckoutSessionId: session.id,
                });

                await db
                  .update(promoCodes)
                  .set({
                    timesRedeemed: sql`${promoCodes.timesRedeemed} + 1`,
                    totalDiscountGiven: sql`${promoCodes.totalDiscountGiven} + ${totalDiscount}`,
                    updatedAt: new Date(),
                  })
                  .where(eq(promoCodes.id, promo.id));
              }
            }
          }
        } catch (err) {
          console.error("Failed to track promo redemption:", err);
        }
      }

      if (customerId) {
        await syncOrgBillingProfile(customerId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const planId = getPlanFromSubscription(subscription);
      const extraSeatQuantity = getExtraSeatQuantityFromSubscription(
        subscription,
      );

      if (planId) {
        const [existingOrg] = await db
          .select({
            id: organizations.id,
            customLimits: organizations.customLimits,
          })
          .from(organizations)
          .where(eq(organizations.stripeSubscriptionId, subscription.id))
          .limit(1);

        if (existingOrg) {
          const isManagedEntitlement = isEntitlementManaged(subscription);
          const updateValues: Record<string, unknown> = {
            planId,
            updatedAt: new Date(),
          };
          if (isManagedEntitlement) {
            updateValues.planOverride = planId;
            updateValues.trialEndsAt = null;
            updateValues.planExpiresAt = null;
          }

          if (!existingOrg.customLimits) {
            const plan = PLANS[planId];
            updateValues.projectLimit = clampLimit(plan.projectLimit);
            updateValues.memberLimit = clampLimit(
              plan.memberLimit + extraSeatQuantity,
            );
            updateValues.memoryLimitPerProject = null;
            updateValues.memoryLimitOrg = null;
            updateValues.apiRatePerMinute = null;
            updateValues.customLimits = false;
          }

          await db
            .update(organizations)
            .set(updateValues)
            .where(eq(organizations.id, existingOrg.id));
          await enforceSeatComplianceStatus(existingOrg.id);
        }
      }

      const customerId = getCustomerId(subscription.customer);
      if (customerId) {
        await syncOrgBillingProfile(customerId);
      }
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object;
      const customerId = getCustomerId(subscription.customer);
      const planId = getPlanFromSubscription(subscription);
      const extraSeatQuantity = getExtraSeatQuantityFromSubscription(
        subscription,
      );
      const metadataOrgSlug = getOrgSlugFromMetadata(subscription.metadata);

      let existingOrg:
        | {
            id: string;
            stripeSubscriptionId: string | null;
            customLimits: boolean | null;
          }
        | undefined;

      if (metadataOrgSlug) {
        [existingOrg] = await db
          .select({
            id: organizations.id,
            stripeSubscriptionId: organizations.stripeSubscriptionId,
            customLimits: organizations.customLimits,
          })
          .from(organizations)
          .where(eq(organizations.slug, metadataOrgSlug))
          .limit(1);
      }
      if (!existingOrg && customerId) {
        [existingOrg] = await db
          .select({
            id: organizations.id,
            stripeSubscriptionId: organizations.stripeSubscriptionId,
            customLimits: organizations.customLimits,
          })
          .from(organizations)
          .where(eq(organizations.stripeCustomerId, customerId))
          .limit(1);
      }

      if (
        existingOrg &&
        (!existingOrg.stripeSubscriptionId ||
          existingOrg.stripeSubscriptionId === subscription.id)
      ) {
        const updateValues: Record<string, unknown> = {
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date(),
        };
        if (customerId) {
          updateValues.stripeCustomerId = customerId;
        }
        if (planId) {
          updateValues.planId = planId;
          if (isEntitlementManaged(subscription)) {
            updateValues.planOverride = planId;
            updateValues.trialEndsAt = null;
            updateValues.planExpiresAt = null;
          }
          if (!existingOrg.customLimits) {
            const plan = PLANS[planId];
            updateValues.projectLimit = clampLimit(plan.projectLimit);
            updateValues.memberLimit = clampLimit(
              plan.memberLimit + extraSeatQuantity,
            );
            updateValues.memoryLimitPerProject = null;
            updateValues.memoryLimitOrg = null;
            updateValues.apiRatePerMinute = null;
            updateValues.customLimits = false;
          }
        }

        await db
          .update(organizations)
          .set(updateValues)
          .where(eq(organizations.id, existingOrg.id));

        await enforceSeatComplianceStatus(existingOrg.id);
      }

      if (customerId) {
        await syncOrgBillingProfile(customerId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;

      const [existingOrg] = await db
        .select({
          id: organizations.id,
          customLimits: organizations.customLimits,
        })
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscription.id))
        .limit(1);

      if (!existingOrg) {
        break;
      }

      const freePlan = PLANS.free;
      const updateValues: Record<string, unknown> = {
        planId: "free",
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      };
      if (isEntitlementManaged(subscription) || !existingOrg.customLimits) {
        updateValues.planOverride = null;
        updateValues.customLimits = false;
        updateValues.projectLimit = freePlan.projectLimit;
        updateValues.memberLimit = freePlan.memberLimit;
        updateValues.memoryLimitPerProject = null;
        updateValues.memoryLimitOrg = null;
        updateValues.apiRatePerMinute = null;
        updateValues.planTemplateId = null;
        updateValues.trialEndsAt = null;
        updateValues.planExpiresAt = null;
      }

      await db
        .update(organizations)
        .set(updateValues)
        .where(eq(organizations.id, existingOrg.id));
      await enforceSeatComplianceStatus(existingOrg.id);
      break;
    }

    case "invoice.payment_failed": {
      // Could send notification, for now just log
      console.error("Payment failed:", event.data.object.id);
      break;
    }

    case "customer.updated": {
      const customer = event.data.object;
      const customerId = getCustomerId(customer);
      if (customerId) {
        await syncOrgBillingProfile(customerId);
      }
      break;
    }

    case "customer.tax_id.created":
    case "customer.tax_id.deleted": {
      const taxId = event.data.object;
      const customerId = getCustomerId(taxId.customer);
      if (customerId) {
        await syncOrgBillingProfile(customerId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function getPlanFromPriceId(priceId: string): PlanId | null {
  if (priceId === (process.env.STRIPE_LITE_PRICE_ID ?? "__missing__")) {
    return "lite";
  }
  if (priceId === (process.env.STRIPE_PRO_PRICE_ID ?? "__missing__")) {
    return "pro";
  }
  if (priceId === (process.env.STRIPE_BUSINESS_PRICE_ID ?? "__missing__")) {
    return "business";
  }
  if (priceId === (process.env.STRIPE_SCALE_PRICE_ID ?? "__missing__")) {
    return "scale";
  }
  return null;
}

function getPlanFromSubscription(subscription: {
  items: { data: Array<{ price: { id: string } }> };
  metadata?: Record<string, string | undefined> | null;
}): PlanId | null {
  for (const item of subscription.items.data) {
    const planId = getPlanFromPriceId(item.price.id);
    if (planId) return planId;
  }
  const metadataPlanId = getPlanFromMetadata(subscription.metadata);
  if (metadataPlanId) return metadataPlanId;
  if (subscription.metadata?.adminCreated === "true") return "enterprise";
  return null;
}

function getPlanFromMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): PlanId | null {
  const entitlementPlanId = metadata?.entitlementPlanId;
  if (
    entitlementPlanId &&
    (PLAN_IDS as readonly string[]).includes(entitlementPlanId)
  ) {
    return entitlementPlanId as PlanId;
  }
  return null;
}

function getOrgSlugFromMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): string | null {
  const orgSlug = metadata?.orgSlug;
  if (!orgSlug) return null;
  return orgSlug;
}

function isEntitlementManaged(subscription: {
  metadata?: Record<string, string | undefined> | null;
}): boolean {
  if (subscription.metadata?.entitlementManaged === "true") return true;
  if (subscription.metadata?.adminCreated === "true") return true;
  return false;
}

function getExtraSeatQuantityFromSubscription(subscription: {
  items: { data: Array<{ price: { id: string }; quantity: number | null }> };
}): number {
  if (!STRIPE_EXTRA_SEAT_PRICE_ID) return 0;

  const extraSeatItem = subscription.items.data.find(
    (item) => item.price.id === STRIPE_EXTRA_SEAT_PRICE_ID,
  );
  return extraSeatItem?.quantity ?? 0;
}

function getCustomerId(
  customer: string | { id: string } | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

function formatBillingAddress(address: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
} | null): string | null {
  if (!address) return null;

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter((value): value is string => Boolean(value && value.trim().length));

  if (parts.length === 0) return null;
  return parts.join(", ");
}

async function syncOrgBillingProfile(customerId: string): Promise<void> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (!org) return;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return;

    const taxIds = await stripe.customers.listTaxIds(customerId, { limit: 10 });
    const firstTaxId = taxIds.data[0]?.value ?? null;
    const billingAddress = formatBillingAddress(customer.address);

    await db
      .update(organizations)
      .set({
        companyName: customer.name ?? null,
        taxId: firstTaxId,
        billingAddress,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
  } catch (err) {
    console.error("Failed to sync org billing profile:", err);
  }
}

async function enforceSeatComplianceStatus(orgId: string): Promise<void> {
  const [org] = await db
    .select({
      id: organizations.id,
      memberLimit: organizations.memberLimit,
      status: organizations.status,
      statusReason: organizations.statusReason,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return;

  const [memberCount] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const isOverLimit = (memberCount?.value ?? 0) > org.memberLimit;
  const overLimitReason = "seat_limit_exceeded_unpaid";

  if (isOverLimit && org.status !== "suspended") {
    await db
      .update(organizations)
      .set({
        status: "suspended",
        statusReason: overLimitReason,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
    return;
  }

  if (
    !isOverLimit &&
    org.status === "suspended" &&
    org.statusReason === overLimitReason
  ) {
    await db
      .update(organizations)
      .set({
        status: "active",
        statusReason: null,
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
  }
}
