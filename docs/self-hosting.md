# Self-Hosting

Run memctl on your own infrastructure with no billing, no Stripe, and unlimited everything.

## What self-hosted mode does

When `SELF_HOSTED=true`:

- All new organizations are created with **enterprise** plan limits (unlimited projects, members, memories, API rate)
- **Billing is completely disabled** — no Stripe customer creation, no checkout, no webhooks
- The billing page shows a simple "Self-Hosted (Unlimited)" view instead of plan cards
- Existing organizations automatically get unlimited limits on next access

## Quick start with Docker Compose

```bash
git clone https://github.com/your-org/memctl.git
cd memctl

cat > .env <<'EOF'
# Database (local libSQL)
TURSO_DATABASE_URL=http://localhost:8080
TURSO_AUTH_TOKEN=

# Auth — use dev bypass for quick testing, or set up GitHub OAuth
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000

# Self-hosted mode
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MEMCTL_API_URL=http://localhost:3000/api/v1
EOF

docker compose up -d
docker compose exec web pnpm db:push
```

Open http://localhost:3000 — you should be auto-logged in with the dev bypass user.

## Required env vars (minimal set)

| Variable | Value | Notes |
|----------|-------|-------|
| `TURSO_DATABASE_URL` | `http://localhost:8080` | Or any libSQL/Turso URL |
| `BETTER_AUTH_SECRET` | random string | Minimum 32 characters |
| `BETTER_AUTH_URL` | your app URL | e.g. `http://localhost:3000` |
| `SELF_HOSTED` | `true` | Enables self-hosted mode |
| `NEXT_PUBLIC_SELF_HOSTED` | `true` | Client-side self-hosted flag |
| `NEXT_PUBLIC_APP_URL` | your app URL | e.g. `http://localhost:3000` |

## Auth options

### Dev bypass (simplest)

Set `DEV_AUTH_BYPASS=true` and `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`. A dev user and organization are created automatically. Good for personal use or testing.

### GitHub OAuth

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` with a GitHub OAuth app. The callback URL should be `{BETTER_AUTH_URL}/api/auth/callback/github`.

## What's disabled

- **Billing page**: shows "Self-Hosted (Unlimited)" instead of Stripe plan cards
- **Checkout API**: returns 400 "Billing is not enabled"
- **Portal API**: returns 400 "Billing is not enabled"
- **Stripe webhook**: returns 400 "Billing is not enabled"
- **Stripe customer creation**: skipped during org creation

No Stripe env vars are needed in self-hosted mode.
