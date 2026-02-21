# Billing Plan Example (Individuals + Businesses + Apple Pay)

Use this as a reference model for Stripe billing in memctl.

## Goal

- Individuals can subscribe with card, Apple Pay, Google Pay, Link.
- Businesses can subscribe with card/wallets and optionally invoice/manual payment.
- Same product plans, different checkout details based on buyer type.

## Suggested plan catalog

| Plan | Monthly Price | Buyer Types | Notes |
|---|---:|---|---|
| Lite | $5 | Individual, Business | Entry plan |
| Pro | $20 | Individual, Business | Team starter |
| Business | $40 | Business (default), Individual (optional) | Adds higher limits + invoices |
| Scale | $80 | Business | Higher limits, priority support |
| Enterprise | Custom | Business | Sales-led contract |

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

For the actual enforced limits per plan (memory counts, API calls, rate limits), see the [Organization & Teams](./organization-and-teams.md#plan-limits) documentation. The limits are defined in `packages/shared/src/constants.ts`.

## Example env for plan IDs

```env
STRIPE_LITE_PRICE_ID=price_123
STRIPE_PRO_PRICE_ID=price_456
STRIPE_BUSINESS_PRICE_ID=price_789
STRIPE_SCALE_PRICE_ID=price_abc
```
