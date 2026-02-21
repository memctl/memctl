# Local Development

How to run the full memctl stack locally, test the CLI and MCP server against it, and run tests.

## Prerequisites

- Docker Desktop v24+
- Node.js 20+ (for CLI and tests)
- pnpm (for monorepo management)

## Starting the local stack

```bash
# 1. Clone and enter the repo
git clone https://github.com/your-org/memctl.git
cd memctl

# 2. Copy env template
cp .env.example .env

# 3. Set required values in .env
#    Minimum: BETTER_AUTH_SECRET (any long random string)
#    Choose one auth mode:
#      Option A: GitHub OAuth (GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET)
#      Option B: Dev bypass (DEV_AUTH_BYPASS=true + NEXT_PUBLIC_DEV_AUTH_BYPASS=true)

# 4. Start the services
docker compose up -d

# 5. Push the database schema (first run only)
docker compose exec web pnpm db:push

# 6. Open http://localhost:3000
```

This starts two services:

- **libsql** — SQLite-compatible database on ports 8080 (HTTP) and 5001
- **web** — Next.js dev server on port 3000 with hot reload

Source code is bind-mounted, so edits on the host trigger hot reload automatically.

## Dev auth bypass

For local development without configuring GitHub OAuth:

```env
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
DEV_AUTH_BYPASS_ORG_SLUG=dev-org
NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG=dev-org
DEV_AUTH_BYPASS_USER_EMAIL=dev@local.memctl.test
DEV_AUTH_BYPASS_USER_NAME=Dev User
```

This creates a dev user and org automatically. The login page shows a "Continue with Dev Bypass" button.

## Getting an API token

Once logged in to the dashboard at `http://localhost:3000`:

1. Create a project (or use the auto-created one if using dev bypass)
2. Go to **Settings > API Tokens**
3. Generate a token

Or use the API directly:

```bash
# With dev bypass, you can create a token via the API
curl -X POST http://localhost:3000/api/v1/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{"name": "dev-token"}'
```

## Testing the CLI against localhost

Set your env vars to point at the local server:

```bash
export MEMCTL_TOKEN=your-local-token
export MEMCTL_ORG=dev-org
export MEMCTL_PROJECT=your-project
export MEMCTL_API_URL=http://localhost:3000/api/v1
```

Then use the CLI normally:

```bash
# From the repo root (using the local build)
pnpm --filter memctl build
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js list
node packages/cli/dist/index.js search "test"
node packages/cli/dist/index.js capacity

# Or with npx if published
npx memctl doctor
```

## Testing MCP with Claude Code locally

Create `.claude/mcp.json` in your project:

```json
{
  "mcpServers": {
    "memctl": {
      "command": "node",
      "args": ["/path/to/memctl/packages/cli/dist/index.js"],
      "env": {
        "MEMCTL_TOKEN": "your-local-token",
        "MEMCTL_API_URL": "http://localhost:3000/api/v1",
        "MEMCTL_ORG": "dev-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

This points Claude Code at your local build instead of the npm package. Rebuild after changes:

```bash
pnpm --filter memctl build
```

Then restart Claude Code to reconnect the MCP server.

## Database operations

```bash
# Push schema changes (after modifying packages/db/src/schema.ts)
docker compose exec web pnpm db:push

# Generate migrations
docker compose exec web pnpm db:generate

# Run migrations
docker compose exec web pnpm db:migrate

# Open Drizzle Studio (from host, not inside Docker)
TURSO_DATABASE_URL=http://localhost:8080 TURSO_AUTH_TOKEN= pnpm --filter @memctl/db dlx drizzle-kit studio
```

Drizzle Studio opens a web UI for browsing and editing the database directly.

## Running tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter memctl test
pnpm --filter @memctl/shared test

# Run tests in watch mode
pnpm --filter memctl test -- --watch
```

Tests use Vitest. Test suites cover:

- CLI cache (TTL, ETag storage, invalidation)
- Local SQLite cache (sync, search, offline reads, pending writes)
- API client (caching, ETag revalidation, offline fallback)
- Rate limiting (sliding window, plan tiers)
- ETag generation and conditional requests
- Cosine similarity
- Hybrid search merging (RRF)
- Webhook HMAC signatures
- Zod schema validators
- Doctor diagnostics
- Init wizard
- Session/git integration
- Tool dispatch
- Relevance scoring

## Building the CLI locally

```bash
# Build the CLI package
pnpm --filter memctl build

# The built files are in packages/cli/dist/
# Run directly:
node packages/cli/dist/index.js --help
```

## Stripe webhook testing

To test Stripe webhooks locally:

1. Set `STRIPE_SECRET_KEY=sk_test_...` in `.env`
2. Start the tools profile:

```bash
docker compose --profile tools up -d
```

This starts a Stripe CLI container that forwards webhook events to `http://web:3000/api/stripe/webhook`. On first run, it prints a pairing URL — open it in your browser to authenticate.

## Production-like local testing

```bash
docker compose -f docker-compose.prod.yml up --build
```

This builds a standalone production image with no volume mounts. Everything is baked in. Useful for testing production builds before deploying.

## Rebuilding from clean state

If things get stuck:

```bash
docker compose down -v        # Stop and remove volumes
docker compose up --build -d  # Rebuild and start fresh
docker compose exec web pnpm db:push  # Re-push schema
```

## Common issues

See [Troubleshooting](./troubleshooting.md) for solutions to common Docker, auth, and database issues.
