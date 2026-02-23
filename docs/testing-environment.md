# Testing Environment Setup (Docker Compose)

This guide is for local development and dashboard testing.

## 1. Create `.env`

From project root:

```bash
cp .env.example .env
```

If `.env` is missing, `docker compose` fails with:

- `env file .../.env not found`

## 2. Configure required env vars

Set at least:

- `BETTER_AUTH_SECRET` (long random string)
- `BETTER_AUTH_URL=http://localhost:3000`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

And one auth mode:

- GitHub OAuth mode: `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- Dev bypass mode: `DEV_AUTH_BYPASS=true` + `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`

Quick secret generation:

```bash
openssl rand -base64 32
```

For non-Stripe testing, Stripe variables can stay empty.

### No GitHub credentials (dev bypass)

If you want local dashboard testing without GitHub OAuth credentials, set:

```env
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
DEV_AUTH_BYPASS_ORG_SLUG=dev-org
NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG=dev-org
DEV_AUTH_BYPASS_USER_EMAIL=dev@local.memctl.test
DEV_AUTH_BYPASS_USER_NAME=Dev User
DEV_AUTH_BYPASS_ADMIN=false
```

When enabled, the app seeds a local dev user/org and treats requests as authenticated in development.

## 3. Create a local GitHub OAuth app (optional if using dev bypass)

In GitHub Developer Settings, create an OAuth app with:

- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

Use that client id/secret in `.env`.

## 4. Start local services

```bash
docker compose up -d
```

This starts:

- `libsql` on `localhost:8080`
- `web` on `localhost:3000`

## 5. Initialize DB (first run only)

```bash
docker compose exec web pnpm db:push
```

## 6. Seed sample data (optional)

To populate a project with sample memories for testing the Graph tab visualization:

```bash
docker compose exec web pnpm db:seed-graph
```

This inserts ~30 memories with relatedKeys relationships forming clusters and orphan nodes. To target a specific project:

```bash
docker compose exec web pnpm db:seed-graph my-project
```

If no project slug is given, the script finds the first project under the dev org. Safe to re-run (deletes old seed data first).

## 7. Test dashboard login

Open `http://localhost:3000/login` and sign in with GitHub.

There is no built-in local username/password. Dashboard auth is GitHub OAuth.

If dev bypass is enabled, `/login` also shows a `Continue with Dev Bypass` button that jumps directly to `/{orgSlug}`.

## 8. Admin testing options

Admin login (`/admin/login`) uses magic link and only allows `@memctl.com` addresses.

You have three options:

1. Use real admin flow: Use a real `@memctl.com` inbox and configure `RESEND_API_KEY` so the magic link email is delivered.
2. Local maintainer flow: Sign in with GitHub first, then mark your local user as admin in the DB.
3. Dev bypass admin mode: set `DEV_AUTH_BYPASS_ADMIN=true` (with dev bypass enabled), restart web, then open `/admin`.

### Dev magic-link workaround (no Resend delivery)

In development, if `RESEND_API_KEY` is empty, the server logs the generated magic-link URL.

1. Run `docker compose logs -f web`
2. Submit admin login at `/admin/login`
3. Copy the URL shown under `[DEV MAGIC LINK]` and open it in your browser

This lets you complete the real magic-link auth flow locally without outbound email delivery.

### Local maintainer flow (no `@memctl.com` inbox required)

1. Sign in once at `/login` so your user row is created.
2. Open Drizzle Studio:

```bash
TURSO_DATABASE_URL=http://localhost:8080 TURSO_AUTH_TOKEN= pnpm --filter @memctl/db dlx drizzle-kit studio
```

3. In `users`, set `is_admin` to `1` for your user.
4. Open `http://localhost:3000/admin`.

## 9. Stripe testing (optional)

If you want checkout/webhooks:

1. Set `STRIPE_SECRET_KEY=sk_test_...` in `.env`
2. Start tools profile:

```bash
docker compose --profile tools up -d
```

## 10. Production-like local test (optional)

```bash
docker compose -f docker-compose.prod.yml up --build
```

Use this when you want to test a production image locally (no source bind mounts).

## Common errors and fixes

### Error: `STRIPE_SECRET_KEY variable is not set`

- Cause: variable is empty.
- Fix: set `STRIPE_SECRET_KEY` in `.env`.
- Note: safe to ignore if you are not testing Stripe flows.

### Error: `.env not found`

- Cause: root `.env` does not exist.
- Fix:

```bash
cp .env.example .env
```

### App starts but auth fails

- Cause: GitHub OAuth values are missing or callback URL does not match.
- Fix: set OAuth callback to:
  - `http://localhost:3000/api/auth/callback/github`

### Rebuild from clean state

```bash
docker compose down -v
docker compose up --build -d
```
