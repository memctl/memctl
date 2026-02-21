# Contributing to memctl

Thanks for your interest in contributing. This document covers how to get started, what we expect from contributions, and how the project is organized.

## Getting started

```bash
git clone https://github.com/your-org/memctl.git
cd memctl
pnpm install
cp .env.example .env
# Edit .env — at minimum set BETTER_AUTH_SECRET and an auth mode
docker compose up -d
docker compose exec web pnpm db:push
pnpm --filter memctl build
pnpm test
```

See [docs/local-development.md](docs/local-development.md) for the full setup walkthrough.

## Project structure

```
memctl/
├── apps/web/              Next.js web app (dashboard + REST API)
├── packages/cli/          MCP server + CLI (published as `memctl` on npm)
├── packages/db/           Drizzle ORM schema (libSQL/Turso)
├── packages/shared/       Shared constants, validators, relevance scoring
├── docker-compose.yml     Local dev environment
└── docs/                  Documentation
```

## How to contribute

### Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, IDE, memctl version)

### Suggesting features

Open an issue describing the use case, not just the solution. Explain what problem you're trying to solve and why existing functionality doesn't cover it.

### Submitting code

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests for your changes
4. Run the full check suite:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

5. Open a pull request with a clear description

#### What makes a good PR

- Focused on one thing (a bug fix, a feature, a refactor — not all three)
- Includes tests for new behavior
- Doesn't break existing tests
- Updates documentation if the change affects user-facing behavior
- Follows the existing code style (see below)

### Types of contributions

#### Adding an MCP tool action

Most contributions add actions to existing tools. See [docs/contributing.md](docs/contributing.md) for step-by-step instructions including which handler file to modify, how to add API client methods, and how to create API endpoints.

#### Adding a CLI command

Add the command handler in `packages/cli/src/cli.ts`, register it in `packages/cli/src/index.ts`, and document it in `docs/cli-reference.md`.

#### Adding an API endpoint

Create a route under `apps/web/app/api/v1/`, use the auth middleware, add Zod validation, and add a corresponding client method in `packages/cli/src/api-client.ts`.

#### Fixing bugs

If you found a bug and want to fix it, include a test that fails without your fix and passes with it.

#### Documentation

Documentation improvements are welcome. Docs live in the `docs/` directory. Keep the style plain and concise — no diagrams, no emoji headers, just clear explanations and code examples.

## Code style

- **TypeScript strict mode** everywhere
- **Named exports** — no default exports
- **Early returns** over nested conditionals
- **Zod** for runtime validation of external input
- **Drizzle ORM** for database queries
- Keep things simple. Don't abstract prematurely.

The project uses ESLint and Prettier. Run `pnpm lint` and `pnpm format:check` before submitting.

## Testing

Tests use [Vitest](https://vitest.dev/).

```bash
pnpm test                                    # All tests
pnpm --filter memctl test                    # CLI package only
pnpm --filter @memctl/shared test            # Shared package only
pnpm --filter memctl test -- --watch         # Watch mode
pnpm --filter memctl test -- src/cache.test.ts  # Single file
```

Write tests for:

- New tool actions (mock the API client, verify behavior)
- New API endpoints (test request/response shapes, auth, validation)
- Bug fixes (regression test that fails without the fix)

## Commit messages

Use clear, descriptive commit messages. We don't enforce a strict format, but prefer something like:

```
feat: add memory rollback support
fix: handle expired tokens in offline mode
docs: add troubleshooting guide for Docker issues
test: add coverage for session claim conflicts
```

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

## Questions?

Open an issue or reach out in discussions. We're happy to help you find the right place to contribute.
