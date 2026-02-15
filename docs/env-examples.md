# Environment Variables Examples

Use these as starting points for local testing.

## Example 1: Basic local testing (no Stripe)

```env
# Database
TURSO_DATABASE_URL=http://localhost:8080
TURSO_AUTH_TOKEN=

# Auth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
BETTER_AUTH_SECRET=replace_with_a_long_random_secret
BETTER_AUTH_URL=http://localhost:3000

# Stripe (not used in this scenario)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_LITE_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=
STRIPE_SCALE_PRICE_ID=

# MCP Server
MEMCTL_API_URL=http://localhost:3000/api/v1

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Example 2: Local Stripe webhook testing

```env
# Keep auth/database/app values same as above, then set Stripe test keys:
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Optional: test price ids
STRIPE_LITE_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_BUSINESS_PRICE_ID=price_xxx
STRIPE_SCALE_PRICE_ID=price_xxx
```

## Copy/paste quick bootstrap

```bash
cp .env.docker .env
# edit .env
docker compose up -d
docker compose exec web pnpm db:push
```
