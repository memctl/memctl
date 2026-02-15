import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { organizations } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { PLANS } from "@memctl/shared/constants";
import type { PlanId } from "@memctl/shared/constants";

export async function POST(req: NextRequest) {
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
    [process.env.STRIPE_BETTER_PRICE_ID ?? ""]: "better",
  };
  return priceMap[priceId] ?? null;
}
