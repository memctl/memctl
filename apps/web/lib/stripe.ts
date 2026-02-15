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
    price: 4000,
  },
  better: {
    priceId: process.env.STRIPE_BETTER_PRICE_ID ?? "",
    name: "Better",
    price: 8000,
  },
};

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  orgSlug: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return getStripe().checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { orgSlug: params.orgSlug },
  });
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
