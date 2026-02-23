# memctl

Shared, persistent memory for AI coding agents. pnpm monorepo with Turborepo.

```
apps/web/          @memctl/web      Next.js 15 dashboard + REST API
packages/cli/      memctl           MCP server + CLI (npm)
packages/db/       @memctl/db       Drizzle ORM schema + migrations
packages/shared/   @memctl/shared   Types, validators, constants
```

## Rules

- Never use em dashes. Use commas, periods, or parentheses.
- Never use AI filler phrases ("it's important to note", "it's worth mentioning", etc.).
- Write direct, active voice, short sentences.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Do not add emojis to files.
- **Never run `pnpm build` or `next build` unless explicitly asked.** Use `npx tsc --noEmit -p apps/web/tsconfig.json` for type checking.

## Commands

```bash
pnpm dev                                       # Dev server (Turbopack)
pnpm install                                   # Install deps
npx tsc --noEmit -p apps/web/tsconfig.json     # Typecheck web
pnpm lint                                      # ESLint all packages
pnpm format:check                              # Prettier check
npx vitest run                                 # Run tests
pnpm db:push                                   # Push schema to DB
pnpm db:generate                               # Generate migrations
pnpm db:migrate                                # Run migrations
```

## Environments

Three modes: **dev**, **self-hosted**, and **production**. All code changes must work across all three.

### Development

Local dev with Docker Compose or bare metal. See `DOCKER.md` for Docker setup.

```bash
# Docker
cp .env.example .env
docker compose up
docker compose exec web pnpm db:push

# Bare metal
pnpm install && pnpm dev
```

Key env vars for dev:
- `DEV_AUTH_BYPASS=true` + `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` skips GitHub OAuth
- `DEV_AUTH_BYPASS_ORG_SLUG=dev-org` sets the dev org
- `TURSO_DATABASE_URL=http://localhost:8080` for local libSQL
- `DEV_PLAN=enterprise` overrides the billing plan

Docker Compose runs libSQL on port 8080 and the web app on port 3000 with hot reload.

### Self-Hosted

Set `SELF_HOSTED=true` and `NEXT_PUBLIC_SELF_HOSTED=true`. This disables all billing/Stripe logic and unlocks plan limits. No Stripe keys needed.

Self-hosted deployments use the same Docker production image but skip payment walls. When adding billing-gated features, always check self-hosted mode:
```typescript
const isSelfHosted = process.env.SELF_HOSTED === "true";
// or on client: process.env.NEXT_PUBLIC_SELF_HOSTED === "true"
```

### Production

Multi-stage Dockerfile builds a standalone Next.js image. See `DOCKER.md` for full instructions.

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com -t memctl-web .
```

Required env vars for production:
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (Turso cloud)
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET` (unless self-hosted)
- `NEXT_PUBLIC_APP_URL`

### Environment Checklist

When adding features, verify:
1. Works in dev with `DEV_AUTH_BYPASS=true` (no OAuth, no Stripe)
2. Works in self-hosted mode (no billing, all limits unlocked)
3. Works in production (real auth, real Stripe, Turso cloud)
4. New env vars are added to `.env.example` with sensible defaults
5. Docker builds still pass (no missing build-time vars in `Dockerfile`)

## Docker

- `Dockerfile` - Multi-stage production build (standalone Next.js, non-root user, port 3000)
- `Dockerfile.dev` - Dev image with bind-mounted source for hot reload
- `docker-compose.yml` - Dev stack: libSQL + web + optional Stripe CLI
- `docker-compose.prod.yml` - Production-like local testing

When modifying dependencies or build config, verify both Dockerfiles still work. The production Dockerfile needs placeholder env vars at build time because Next.js inlines `NEXT_PUBLIC_*` values.

## Frontend Design

- Dark theme with CSS vars: `--landing-text`, `--landing-surface`, `--landing-border`, etc.
- Accent color: `#F97316` (orange).
- Dense, terminal-like aesthetic: `font-mono`, `text-[10px]`/`text-[11px]`/`text-xs`, tight padding (`px-3 py-1.5`).
- Card containers use the `dash-card` class.
- UI primitives from `@/components/ui/` (shadcn/ui). Icons from `lucide-react`. Animations from `motion`.
- Fill the screen. No large empty gaps. Use `max-h` + `overflow-y-auto` for scrollable panels.
- No bare pipe separators. Use `h-3 w-px bg-[var(--landing-border)]` or flex gap.
- No trailing borders on last items. Use index checks instead of `divide-y`.
- Empty states need a lucide icon + short message + hint when caused by filters.
- Loading: skeletons during filter changes, pulsing dots during infinite scroll.

### Responsiveness

- All layouts must work on 320px+ (mobile), 768px+ (tablet), 1024px+ (desktop).
- Sidebar is hidden on mobile (`hidden md:flex`), rendered in a Sheet drawer via `MobileSidebarSheet`.
- Responsive padding on main content: `px-4 py-4 md:px-8 md:py-6`.
- Tab bars use `overflow-x-auto scrollbar-hide` with `shrink-0` on each tab button.
- Tables with >4 columns: wrap in `overflow-x-auto` or hide columns with `hidden sm:table-cell` / `hidden md:table-cell` / `hidden lg:table-cell`.
- Grids need intermediate breakpoints (e.g. `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`).
- Filter/chip rows use `flex-wrap`.
- Touch targets: min 36px on mobile (`h-9 md:h-7` or `h-9 md:h-8`).
- Filter popovers: `w-64 sm:w-72`.
- Page header rows with actions: `flex-wrap gap-3` so buttons stack below on narrow screens.

## Architecture

- **Auth**: better-auth with GitHub OAuth + magic link + dev bypass. Dashboard uses cookie-based `auth.api.getSession()`. API routes use Bearer tokens via `authenticateRequest()`.
- **Access control**: owner/admin see everything, members only see assigned projects via `projectMembers`.
- **API pattern**: `withApiMiddleware` -> `authenticateRequest` -> `requireOrgMembership` -> `checkProjectAccess` -> `checkRateLimit` -> handler.
- **Database**: Turso (libSQL) with Drizzle ORM. 24 tables. Migrations in `packages/db/src/migrations/`.
- **Activity system**: Hybrid SSR + client. Server renders first 50 items, client takes over with cursor-based pagination and infinite scroll.

## Code Conventions

- Named exports only. No default exports.
- Early returns over nested conditionals.
- Zod for all external input validation.
- Kebab-case filenames, camelCase exports.
- API responses: `{ result?: T; error?: string }`.
- Date serialization: `.toISOString()` for client components.
- Prettier: `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`.
- Unused vars: prefix with `_`.

## CLI/MCP Server

The `memctl` npm package runs as an MCP server (default) or CLI. 11 tools, 7 resources, 3 prompts. See `packages/cli/` for implementation. Config at `~/.memctl/config.json`. Key env vars: `MEMCTL_TOKEN`, `MEMCTL_ORG`, `MEMCTL_PROJECT`, `MEMCTL_API_URL`.

## CI

GitHub Actions on push to main and PRs: lint -> typecheck -> test -> build. CLI auto-publishes to npm on version bump. See `.github/workflows/`.

## Docs

Detailed documentation lives in `docs/`, `README.md`, `DOCKER.md`, `CONTRIBUTING.md`, and `SECURITY.md`. Do not duplicate their content here.
