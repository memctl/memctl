# Billing Plan Example (Individuals + Businesses + Apple Pay)

Use this as a reference model for Stripe billing in memctl.

## Goal

- Individuals can subscribe with card, Apple Pay, Google Pay, Link.
- Businesses can subscribe with card/wallets and optionally invoice/manual payment.
- Same product plans, different checkout details based on buyer type.

## Suggested plan catalog

Prices defined in `apps/web/lib/stripe.ts` (`STRIPE_PLANS`) and `packages/shared/src/constants.ts` (`PLANS`, `EXTRA_SEAT_PRICE`).

| Plan | Monthly Price | Included Seats | Extra Seat | Buyer Types | Notes |
|---|---:|---:|---:|---|---|
| Free | $0 | 1 | N/A | Individual | Solo tier |
| Lite | $5 | 3 | +$8/mo | Individual, Business | Entry plan |
| Pro | $20 | 10 | +$8/mo | Individual, Business | Team starter |
| Business | $59 | 30 | +$8/mo | Business (default), Individual (optional) | Higher limits + invoices |
| Scale | $149 | 100 | +$8/mo | Business | Highest self-serve tier |
| Enterprise | Custom | Unlimited | Included | Business | Sales-led contract |

The extra seat price (`$8/mo`) is defined as `EXTRA_SEAT_PRICE` in `packages/shared/src/constants.ts`.

## Stripe setup pattern

## 1. Products and prices

- Create one Stripe Product per plan (`Lite`, `Pro`, `Business`, `Scale`).
- Create recurring monthly Price objects for each product.
- Put the resulting IDs in `.env`:
  - `STRIPE_LITE_PRICE_ID`
  - `STRIPE_PRO_PRICE_ID`
  - `STRIPE_BUSINESS_PRICE_ID`
  - `STRIPE_SCALE_PRICE_ID`

## 2. Customer type

When creating or syncing Stripe customers, store buyer type in metadata:

- `buyerType=individual` or `buyerType=business`
- For business, collect and sync:
  - company/legal name
  - billing email
  - tax/VAT ID (if applicable)

## 3. Checkout behavior

- For both buyer types, use Stripe Checkout subscription mode.
- For business buyers, enable invoice + tax collection where needed.
- Keep one checkout endpoint, branch behavior by `buyerType`.

Pseudo-flow:

```text
POST /api/v1/orgs/:slug/checkout
  -> validate plan
  -> load organization + stripe customer
  -> read buyerType (individual/business)
  -> create Stripe Checkout session
  -> return checkout URL
```

## Apple Pay and other payment methods

- Apple Pay is supported by Stripe Checkout automatically when eligible.
- You must verify your domain in Stripe for Apple Pay to appear.
- Checkout can also show cards, Link, and Google Pay (depending on device/region).

Practical notes:

- No special "Apple Pay plan" is needed.
- You keep normal recurring prices; wallet support is a checkout/payment-method layer.
- For local development, wallet availability may be limited compared to production domains.

## Plan limits reference

For the actual enforced limits per plan (memory counts, API calls, rate limits), see the [Organization & Teams](./organization-and-teams.md#plan-limits) documentation.

Key source files:
- `packages/shared/src/constants.ts` -- `PLANS` (limits per plan), `EXTRA_SEAT_PRICE` ($8/mo per extra member)
- `apps/web/lib/stripe.ts` -- `STRIPE_PLANS` (Stripe price IDs and display prices)
- `apps/web/lib/plans.ts` -- `getEffectivePlanId()`, `getOrgLimits()`, trial/expiry helpers

## Enterprise billing

Admin-created enterprise subscriptions use custom Stripe prices (no checkout redirect). See `apps/web/lib/stripe.ts`:
- `createCustomPrice()` -- creates a one-off Stripe price for the enterprise deal
- `createAdminSubscription()` -- attaches the price to the org's Stripe customer

Plan templates (`packages/db/src/schema.ts` `planTemplates` table) let admins define reusable limit configurations and apply them to orgs.

## Example env for plan IDs

```env
STRIPE_LITE_PRICE_ID=price_123
STRIPE_PRO_PRICE_ID=price_456
STRIPE_BUSINESS_PRICE_ID=price_789
STRIPE_SCALE_PRICE_ID=price_abc
CRON_SECRET=your-cron-secret
```
