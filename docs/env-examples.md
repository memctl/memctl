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

## Example 3: Local testing without GitHub OAuth

```env
# Keep database/app values same as Example 1, then set:
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
DEV_AUTH_BYPASS_ORG_SLUG=dev-org
NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG=dev-org
DEV_AUTH_BYPASS_USER_EMAIL=dev@local.memctl.test
DEV_AUTH_BYPASS_USER_NAME=Dev User
DEV_AUTH_BYPASS_ADMIN=false
```

Use this for dashboard testing when you do not want to configure GitHub OAuth credentials locally.

## Example 4: Self-hosted (unlimited, no Stripe)

```env
# Database
TURSO_DATABASE_URL=http://localhost:8080
TURSO_AUTH_TOKEN=

# Auth (dev bypass — simplest option)
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
BETTER_AUTH_SECRET=replace_with_a_long_random_secret
BETTER_AUTH_URL=http://localhost:3000

# Self-hosted mode
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MEMCTL_API_URL=http://localhost:3000/api/v1
```

No Stripe keys needed. All limits are unlimited. See [Self-Hosting](./self-hosting.md).

## Example 5: CLI-only (no local server)

If you're using the hosted memctl.com service and just need the CLI or MCP server:

```env
MEMCTL_TOKEN=your-api-token
MEMCTL_ORG=your-org-slug
MEMCTL_PROJECT=your-project-slug
# MEMCTL_API_URL defaults to https://memctl.com/api/v1
```

That's it. No database, auth, or Stripe vars needed.

## Example 6: Production deployment

```env
# Database (Turso cloud)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# Auth
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
BETTER_AUTH_SECRET=your-production-secret-minimum-32-chars
BETTER_AUTH_URL=https://your-domain.com

# Stripe (production keys)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_LITE_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_BUSINESS_PRICE_ID=price_xxx
STRIPE_SCALE_PRICE_ID=price_xxx

# Email
RESEND_API_KEY=re_xxx

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional
LOG_LEVEL=info
GITHUB_TOKEN=ghp_xxx
```

## Copy/paste quick bootstrap

```bash
cp .env.example .env
# edit .env
docker compose up -d
docker compose exec web pnpm db:push
```

See [Configuration](./configuration.md) for the full variable reference.
