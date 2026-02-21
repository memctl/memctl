import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { organizations, promoCodes, promoRedemptions } from "@memctl/db/schema";
import { eq, sql } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";
import { isBillingEnabled } from "@/lib/plans";
import { generateId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not enabled" }, { status: 400 });
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

      if (orgSlug && subscriptionId) {
        // Fetch subscription to get the plan
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const planId = getPlanFromPriceId(priceId);

        if (planId) {
          const plan = PLANS[planId];
          await db
            .update(organizations)
            .set({
              stripeSubscriptionId: subscriptionId,
              planId,
              projectLimit: plan.projectLimit,
              memberLimit: plan.memberLimit,
              updatedAt: new Date(),
            })
            .where(eq(organizations.slug, orgSlug));
        }

        // Track promo code redemption
        try {
          const totalDiscount = session.total_details?.amount_discount ?? 0;
          // Check if a promotion code was applied via discounts
          const discountObjs = (session as Record<string, unknown>).discounts as Array<{ promotion_code?: string }> | undefined;
          const appliedPromoCodeId =
            discountObjs?.[0]?.promotion_code ??
            (typeof (session as Record<string, unknown>).discount === "object" &&
            (session as Record<string, unknown>).discount !== null
              ? ((session as Record<string, unknown>).discount as { promotion_code?: string }).promotion_code
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
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const priceId = subscription.items.data[0]?.price.id;
      const planId = getPlanFromPriceId(priceId);

      if (planId) {
        const plan = PLANS[planId];
        await db
          .update(organizations)
          .set({
            planId,
            projectLimit: plan.projectLimit,
            memberLimit: plan.memberLimit,
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeSubscriptionId, subscription.id));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const freePlan = PLANS.free;
      await db
        .update(organizations)
        .set({
          planId: "free",
          stripeSubscriptionId: null,
          projectLimit: freePlan.projectLimit,
          memberLimit: freePlan.memberLimit,
          updatedAt: new Date(),
        })
        .where(eq(organizations.stripeSubscriptionId, subscription.id));
      break;
    }

    case "invoice.payment_failed": {
      // Could send notification, for now just log
      console.error("Payment failed:", event.data.object.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function getPlanFromPriceId(priceId: string): PlanId | null {
  const priceMap: Record<string, PlanId> = {
    [process.env.STRIPE_LITE_PRICE_ID ?? ""]: "lite",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "pro",
    [process.env.STRIPE_BUSINESS_PRICE_ID ?? ""]: "business",
    [process.env.STRIPE_SCALE_PRICE_ID ?? ""]: "scale",
  };
  return priceMap[priceId] ?? null;
}
