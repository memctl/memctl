# Contributing

How the monorepo is structured and how to add new tools, commands, and endpoints.

## Repository structure

```
memctl/
├── apps/web/           # Next.js app (dashboard + API)
├── packages/cli/       # MCP server + CLI (published as `memctl` on npm)
├── packages/db/        # Drizzle ORM schema
├── packages/shared/    # Constants, validators, relevance scoring
├── docker-compose.yml  # Local dev environment
└── pnpm-workspace.yaml
```

Package names:

- `@memctl/web` — the web app
- `memctl` — the CLI/MCP package
- `@memctl/db` — database schema
- `@memctl/shared` — shared utilities

## Dev setup

```bash
# Install dependencies
pnpm install

# Start the local stack (database + web server)
cp .env.example .env
# Edit .env (see docs/local-development.md)
docker compose up -d
docker compose exec web pnpm db:push

# Build the CLI
pnpm --filter memctl build

# Run tests
pnpm test
```

See [Local Development](./local-development.md) for detailed setup instructions.

## Adding a new MCP tool action

Most contributions add actions to existing tools. Here's the step-by-step:

### 1. Choose the right handler file

| If the action is about... | File |
|---------------------------|------|
| Core memory CRUD | `packages/cli/src/tools/handlers/memory.ts` |
| Analysis, batch, versioning | `packages/cli/src/tools/handlers/memory-advanced.ts` |
| Cleanup, health, lifecycle | `packages/cli/src/tools/handlers/memory-lifecycle.ts` |
| Context assembly, retrieval | `packages/cli/src/tools/handlers/context.ts` |
| Context type definitions | `packages/cli/src/tools/handlers/context-config.ts` |
| Branch plans | `packages/cli/src/tools/handlers/branch.ts` |
| Sessions, handoff | `packages/cli/src/tools/handlers/session.ts` |
| Import/export | `packages/cli/src/tools/handlers/import-export.ts` |
| Repo scanning | `packages/cli/src/tools/handlers/repo.ts` |
| Org defaults, templates | `packages/cli/src/tools/handlers/org.ts` |
| Activity, memos | `packages/cli/src/tools/handlers/activity.ts` |

### 2. Add the action to the handler

Each handler file has a switch/if-else block for `action`. Add a new case:

```typescript
if (action === "my_new_action") {
  const key = String(args.key);
  // ... do the work, usually via client.someMethod()
  return ok({ result: "..." });
}
```

Use the `ok()` and `err()` helpers from the handler's response utilities.

### 3. Add an API client method (if needed)

If your action calls a new API endpoint, add a method to `packages/cli/src/api-client.ts`:

```typescript
async myNewMethod(param: string) {
  return this.request<{ result: string }>("POST", "/memories/my-endpoint", { param });
}
```

### 4. Add the API endpoint (if needed)

Create a route file at `apps/web/app/api/v1/memories/my-endpoint/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, withApiMiddleware } from "@/lib/api-middleware";

export const POST = withApiMiddleware(async (req: NextRequest) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  // ... handle the request

  return NextResponse.json({ result: "..." });
});
```

### 5. Add tests

Tests live alongside source files or in a `__tests__` directory. Use Vitest:

```typescript
import { describe, it, expect } from "vitest";

describe("my new action", () => {
  it("should do the thing", () => {
    // ...
  });
});
```

### 6. Update the schema (if needed)

If your action needs new database columns or tables, edit `packages/db/src/schema.ts` and run:

```bash
docker compose exec web pnpm db:push
```

### 7. Update documentation

Add the new action to `docs/mcp-tools-reference.md` with params, description, and an example.

## Adding a new CLI command

### 1. Add the command to `cli.ts`

In `packages/cli/src/cli.ts`, add a new case to the `switch` block:

```typescript
case "mycommand": {
  const result = await client.myMethod();
  out(result, json);
  break;
}
```

### 2. Update the usage text

In the `printUsage()` function in the same file, add the command line.

### 3. Register the command

In `packages/cli/src/index.ts`, add the command name to the `cliCommands` array so it routes to the CLI handler instead of starting the MCP server.

### 4. Update documentation

Add the command to `docs/cli-reference.md`.

## Adding a new API endpoint

### 1. Create the route

Create a directory and `route.ts` under `apps/web/app/api/v1/`. Next.js uses file-based routing.

### 2. Use the middleware

Wrap your handler with `withApiMiddleware` for logging and error handling. Use `authenticateRequest` for auth.

### 3. Add rate limiting (if it's a write endpoint)

Call `checkRateLimit(authContext)` for mutation endpoints.

### 4. Add validation

Use Zod schemas from `@memctl/shared/validators` or create new ones. Validate request bodies at the top of handlers.

### 5. Add the client method

Add a corresponding method to `packages/cli/src/api-client.ts` so the CLI and MCP server can call it.

## Code style

- TypeScript strict mode
- Named exports (no default exports from modules)
- Early returns over nested conditionals
- Zod for runtime validation
- Drizzle ORM for database queries

## Running tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter memctl test
pnpm --filter @memctl/shared test

# Watch mode
pnpm --filter memctl test -- --watch

# Single file
pnpm --filter memctl test -- src/cache.test.ts
```

## Building

```bash
# Build the CLI
pnpm --filter memctl build

# Build everything
pnpm build

# Type check
pnpm typecheck
```

## Pull requests

- Create a branch from `main`
- Make your changes
- Run `pnpm test` and `pnpm typecheck`
- Open a PR with a clear description of what changed and why
