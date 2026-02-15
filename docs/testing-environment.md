# Testing Environment Setup (Docker Compose)

This guide is focused on local testing and avoids production complexity.

## 1. Create `.env`

From project root:

```bash
cp .env.docker .env
```

If `.env` is missing, `docker compose` will fail with:

- `env file .../.env not found`

## 2. Minimum required variables

Open `.env` and set:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `BETTER_AUTH_SECRET` (long random string)

For non-Stripe testing, Stripe values can stay empty.

## 3. Start services

```bash
docker compose up -d
```

This starts:

- `libsql` on `localhost:8080`
- `web` on `localhost:3000`

## 4. Initialize DB (first run)

```bash
docker compose exec web pnpm db:push
```

## 5. Open app

- http://localhost:3000

## Stripe testing (optional)

If you want webhook/checkout flows:

1. Add `STRIPE_SECRET_KEY=sk_test_...` in `.env`
2. Start Stripe CLI profile:

```bash
docker compose --profile tools up -d
```

## Common errors and fixes

### Error: `STRIPE_SECRET_KEY variable is not set`

- Cause: variable is empty.
- Fix: set `STRIPE_SECRET_KEY` in `.env`.
- Note: safe to ignore if you are not running Stripe flows.

### Error: `.env not found`

- Cause: root `.env` file does not exist.
- Fix:

```bash
cp .env.docker .env
```

### App starts but auth fails

- Cause: GitHub OAuth values are missing or invalid.
- Fix: create a GitHub OAuth App and set callback URL:
  - `http://localhost:3000/api/auth/callback/github`

### Rebuild from clean state

```bash
docker compose down -v
docker compose up --build -d
```
