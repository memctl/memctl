import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@memctl/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import {
  createCustomerPortalSession,
  getStripe,
  STRIPE_PLANS,
} from "@/lib/stripe";
import { isBillingEnabled } from "@/lib/plans";

export async function POST(
  req: Request,
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

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const customer = await getStripe().customers.create({
        email: session.user.email,
        name: org.name,
        metadata: { orgSlug: slug, orgId: org.id },
      });
      customerId = customer.id;
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id));
    } catch {
      return NextResponse.json(
        { error: "Failed to create billing customer" },
        { status: 500 },
      );
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const body = await req.json().catch(() => null);
  const targetPlanId = body?.planId;

  let switchToPlan:
    | { subscriptionId: string; subscriptionItemId: string; newPriceId: string }
    | undefined;

  if (
    targetPlanId &&
    STRIPE_PLANS[targetPlanId] &&
    org.stripeSubscriptionId
  ) {
    const subscription = await getStripe().subscriptions.retrieve(
      org.stripeSubscriptionId,
    );
    const mainItem = subscription.items.data.find(
      (item) =>
        Object.values(STRIPE_PLANS).some((p) => p.priceId === item.price.id) ||
        item.price.id !== (process.env.STRIPE_EXTRA_SEAT_PRICE_ID ?? ""),
    );
    if (mainItem) {
      switchToPlan = {
        subscriptionId: org.stripeSubscriptionId,
        subscriptionItemId: mainItem.id,
        newPriceId: STRIPE_PLANS[targetPlanId].priceId,
      };
    }
  }

  const portalSession = await createCustomerPortalSession({
    customerId,
    returnUrl: `${appUrl}/org/${slug}/billing`,
    switchToPlan,
  });

  return NextResponse.json({ url: portalSession.url });
}
