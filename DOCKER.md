# Docker Setup

Run the memctl monorepo locally with Docker Compose — no manual Node, pnpm, or Turso cloud setup required.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) v24+

## Quick Start

```bash
# 1. Copy the env template
cp .env.example .env

# 2. Fill in your credentials (see sections below)
#    At minimum: BETTER_AUTH_SECRET + one auth mode
#    (GitHub OAuth creds OR DEV_AUTH_BYPASS=true + NEXT_PUBLIC_DEV_AUTH_BYPASS=true)

# 3. Start the dev stack
docker compose up

# 4. Push the database schema (first run only)
docker compose exec web pnpm db:push

# 5. Open http://localhost:3000
```

## GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set:
   - **Application name**: `memctl-local`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the **Client ID** and **Client Secret** into your `.env`

## Stripe Webhook Testing

To test Stripe webhooks locally, start the Stripe CLI container:

```bash
docker compose --profile tools up
```

The Stripe CLI container will forward webhook events to your local web server. You need `STRIPE_SECRET_KEY` set in your `.env` for this to work.

On first run, the Stripe CLI will print a pairing URL — open it in your browser to authenticate.

## Database Operations

The local libSQL database runs on port 8080. Useful commands:

```bash
# Push schema changes
docker compose exec web pnpm db:push

# Generate migrations
docker compose exec web pnpm db:generate

# Run migrations
docker compose exec web pnpm db:migrate
```

### Seed sample data

To populate a project with interconnected memories for testing the Graph tab:

```bash
docker compose exec web pnpm db:seed-graph
```

Or target a specific project by slug:

```bash
docker compose exec web pnpm db:seed-graph my-project
```

This inserts ~30 memories organized into clusters with `relatedKeys` relationships, plus orphan nodes. Re-running deletes old seed data first.

### Drizzle Studio

To open Drizzle Studio against the local database:

```bash
# From the host (not inside Docker)
TURSO_DATABASE_URL=http://localhost:8080 TURSO_AUTH_TOKEN= pnpm --filter @memctl/db dlx drizzle-kit studio
```

## Dev vs Production Mode

### Development (default)

```bash
docker compose up
```

- Source code is bind-mounted — edits on the host trigger hot reload
- Uses `Dockerfile.dev` (deps only, source mounted at runtime)
- Turbopack dev server with fast refresh

### Production-like local testing

```bash
docker compose -f docker-compose.prod.yml up --build
```

- Uses multi-stage `Dockerfile` to build a standalone production image
- No volume mounts — everything is baked into the image
- Useful for testing production builds before deploying

## Production Deployment

Build and run the production image standalone:

```bash
# Build
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com \
  -t memctl-web .

# Run
docker run -p 3000:3000 \
  -e TURSO_DATABASE_URL=libsql://your-db.turso.io \
  -e TURSO_AUTH_TOKEN=your-token \
  -e GITHUB_CLIENT_ID=your-id \
  -e GITHUB_CLIENT_SECRET=your-secret \
  -e BETTER_AUTH_SECRET=your-secret \
  -e BETTER_AUTH_URL=https://your-domain.com \
  -e STRIPE_SECRET_KEY=sk_live_... \
  -e STRIPE_PUBLISHABLE_KEY=pk_live_... \
  -e STRIPE_WEBHOOK_SECRET=whsec_... \
  -e STRIPE_EXTRA_SEAT_PRICE_ID=price_live_... \
  memctl-web
```

### Optional: Private beta page gate

To protect page routes with a password prompt (while leaving API routes available):

```bash
-e BETA_GATE_ENABLED=true \
-e BETA_GATE_HOSTS=dev.memctl.com \
-e BETA_GATE_USERNAME=beta \
-e BETA_GATE_PASSWORD=your-strong-password \
```

Notes:

- The gate applies to page routes only.
- `/api/*` is not beta-password gated.
- API endpoints still use normal memctl auth.
- For safe beta testing, use a separate deployment and separate database.

## Troubleshooting

### Port already in use

```
Error: address already in use :::3000
```

Stop the conflicting process or change the port mapping in `docker-compose.yml` (e.g., `"3001:3000"`).

### Hot reload not working

- Ensure your files are saved (some editors use delayed writes)
- On macOS/Windows, Docker Desktop's file sharing must include the project directory
- Try restarting the web container: `docker compose restart web`

### Module not found after adding a dependency

The `node_modules` volume may be stale. Rebuild:

```bash
docker compose down -v
docker compose up --build
```

If startup install fails with `ERR_PNPM_ENOSPC`, free Docker disk space first (for example by pruning unused images/volumes) and then rerun the commands above.

If startup install fails with `ERR_PNPM_EMFILE` (`too many open files`), ensure you are using the latest `docker-compose.yml` (it sets higher `nofile` limits and a dedicated pnpm store volume), then recreate containers/volumes:

```bash
docker compose down -v
docker compose up --build
```

### Out of memory during build

Increase Docker Desktop's memory allocation in **Settings > Resources** (4 GB+ recommended).

### "dialect is not a constructor" or libSQL errors

Ensure `TURSO_DATABASE_URL` points to `http://libsql:8080` inside Docker (not `localhost`). The `docker-compose.yml` sets this automatically via the `environment` key.
