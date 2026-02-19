# docs

Practical project documentation for local development and testing.

## Guides

- [Testing Environment Setup](./testing-environment.md)
- [Environment Variables Examples](./env-examples.md)
- [Billing Plan Example](./billing-plan-example.md)

## Fast Path

If you only need to start local testing quickly:

```bash
cp .env.example .env
# Fill: BETTER_AUTH_SECRET
# Then choose one auth mode:
#   - GitHub OAuth: GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
#   - No-GitHub local: DEV_AUTH_BYPASS=true + NEXT_PUBLIC_DEV_AUTH_BYPASS=true
# Optional for Stripe tests: STRIPE_SECRET_KEY

docker compose up -d
docker compose exec web pnpm db:push
```

For dashboard/admin testing details (OAuth, admin access options), see:
- [Testing Environment Setup](./testing-environment.md)
