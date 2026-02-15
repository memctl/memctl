# docs

Practical project documentation for local development and testing.

## Guides

- [Testing Environment Setup](./testing-environment.md)
- [Environment Variables Examples](./env-examples.md)
- [Billing Plan Example](./billing-plan-example.md)

## Fast Path

If you only need to start local testing quickly:

```bash
cp .env.docker .env
# Fill: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_SECRET
# Optional for Stripe tests: STRIPE_SECRET_KEY

docker compose up -d
docker compose exec web pnpm db:push
```
