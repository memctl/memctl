import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PLANS: Record<
  string,
  { priceId: string; name: string; price: number }
> = {
  lite: {
    priceId: process.env.STRIPE_LITE_PRICE_ID ?? "",
    name: "Lite",
    price: 500,
  },
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    name: "Pro",
    price: 2000,
  },
  business: {
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID ?? "",
    name: "Business",
    price: 5900,
  },
  scale: {
    priceId: process.env.STRIPE_SCALE_PRICE_ID ?? "",
    name: "Scale",
    price: 14900,
  },
};

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  orgSlug: string;
  successUrl: string;
  cancelUrl: string;
  stripePromoCodeId?: string;
}) {
  return getStripe().checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { orgSlug: params.orgSlug },
    ...(params.stripePromoCodeId
      ? { discounts: [{ promotion_code: params.stripePromoCodeId }] }
      : { allow_promotion_codes: true }),
  });
}

export async function createStripeCouponAndPromoCode(params: {
  code: string;
  discountType: "percent" | "fixed";
  discountAmount: number;
  currency?: string;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: Date;
  firstSubscriptionOnly?: boolean;
}) {
  const s = getStripe();

  const coupon = await s.coupons.create({
    ...(params.discountType === "percent"
      ? { percent_off: params.discountAmount }
      : {
          amount_off: params.discountAmount,
          currency: params.currency ?? "usd",
        }),
    duration: params.duration,
    ...(params.duration === "repeating" && params.durationInMonths
      ? { duration_in_months: params.durationInMonths }
      : {}),
    ...(params.maxRedemptions
      ? { max_redemptions: params.maxRedemptions }
      : {}),
    ...(params.expiresAt
      ? { redeem_by: Math.floor(params.expiresAt.getTime() / 1000) }
      : {}),
  });

  const promoCode = await s.promotionCodes.create({
    coupon: coupon.id,
    code: params.code,
    active: true,
    ...(params.firstSubscriptionOnly
      ? { restrictions: { first_time_transaction: true } }
      : {}),
  });

  return { couponId: coupon.id, promoCodeId: promoCode.id };
}

export async function deactivateStripePromoCode(promoCodeId: string) {
  return getStripe().promotionCodes.update(promoCodeId, { active: false });
}

export async function reactivateStripePromoCode(promoCodeId: string) {
  return getStripe().promotionCodes.update(promoCodeId, { active: true });
}

export async function createCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  return getStripe().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

export async function createCustomPrice(params: {
  unitAmountCents: number;
  productName: string;
  interval: "month" | "year";
}): Promise<{ priceId: string }> {
  const s = getStripe();
  const product = await s.products.create({ name: params.productName });
  const price = await s.prices.create({
    product: product.id,
    unit_amount: params.unitAmountCents,
    currency: "usd",
    recurring: { interval: params.interval },
  });
  return { priceId: price.id };
}

export async function createAdminSubscription(params: {
  customerId: string;
  priceId: string;
  orgSlug: string;
}): Promise<{ subscriptionId: string }> {
  const s = getStripe();
  const subscription = await s.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    metadata: { orgSlug: params.orgSlug, adminCreated: "true" },
  });

  return { subscriptionId: subscription.id };
}

export async function cancelAdminSubscription(
  subscriptionId: string,
): Promise<void> {
  const s = getStripe();
  await s.subscriptions.cancel(subscriptionId);
}
