# Architecture

This document covers the memctl monorepo structure, server architecture, search pipeline, middleware, database schema, and infrastructure.

## Monorepo structure

memctl is a pnpm monorepo with four packages:

```
memctl/
├── apps/
│   └── web/                  # Next.js web app (dashboard + API)
│       ├── app/
│       │   ├── api/v1/       # REST API routes
│       │   ├── (dashboard)/  # Dashboard pages
│       │   └── (marketing)/  # Landing, blog, changelog
│       ├── lib/              # Server utilities
│       │   ├── api-middleware.ts
│       │   ├── rate-limit.ts
│       │   ├── scheduler.ts
│       │   ├── logger.ts
│       │   └── jwt.ts
│       └── components/       # React components
├── packages/
│   ├── cli/                  # MCP server + CLI
│   │   └── src/
│   │       ├── index.ts      # Entry point (routes CLI vs MCP)
│   │       ├── cli.ts        # CLI command handling
│   │       ├── server.ts     # MCP server creation
│   │       ├── api-client.ts # HTTP client with caching
│   │       ├── config.ts     # Config file loading
│   │       ├── init.ts       # Setup wizard
│   │       ├── doctor.ts     # Diagnostics
│   │       ├── cache.ts      # In-memory TTL cache
│   │       ├── local-cache.ts # SQLite offline cache
│   │       ├── agent-context.ts # Context type system
│   │       ├── tools/        # MCP tool handlers (11 files)
│   │       └── resources/    # MCP resource handlers
│   ├── db/                   # Drizzle ORM schema
│   │   └── src/schema.ts     # 24 tables
│   └── shared/               # Shared constants, validators, scoring
│       └── src/
│           ├── constants.ts  # Plan limits, roles
│           ├── validators.ts # Zod schemas
│           └── relevance.ts  # Relevance scoring
├── docker-compose.yml        # Local dev environment
├── Dockerfile.dev            # Dev container
└── Dockerfile                # Production container
```

## MCP server architecture

The CLI package serves two roles depending on how it's invoked:

1. **MCP server** (default, or `memctl serve`) — connects via stdio, exposes tools/resources/prompts
2. **CLI commands** (`memctl list`, `memctl search`, etc.) — direct terminal usage

```
IDE (Claude Code / Cursor / Windsurf)
  └─ stdin/stdout ─→ memctl MCP server
                       ├── 11 tools (90+ actions)
                       ├── 7 resources
                       ├── 3 prompts
                       └── ApiClient ─→ memctl API
                             ├── In-memory cache (30s TTL)
                             ├── ETag revalidation
                             ├── SQLite offline cache
                             └── Pending writes queue
```

On startup, the server:

1. Loads config from env vars or `~/.memctl/config.json`
2. Creates an `ApiClient` with the resolved credentials
3. Registers all tools, resources, and prompts
4. Pings the API — enters offline mode if unreachable
5. Runs incremental sync (if previous sync exists) or initial cache population
6. Connects via `StdioServerTransport`

### Tool registration

Tools are registered through `packages/cli/src/tools/index.ts`. Each handler file exports a `register*Tool` function that adds actions to the MCP server. All tools share a rate limit state for write operations.

## API middleware pipeline

Every API request goes through:

1. **Request logging** (`withApiMiddleware`) — assigns `X-Request-Id`, logs method/path/status/duration
2. **Authentication** (`authenticateRequest`) — validates Bearer token, checks session DB, caches valid sessions
3. **Org membership** (`requireOrgMembership`) — verifies user belongs to the org in `X-Org-Slug`
4. **Project access** (`checkProjectAccess`) — owners/admins access all projects, members need explicit assignment
5. **Rate limiting** (`checkRateLimit`) — sliding-window counter per user, limits based on org plan
6. **Route handler** — the actual endpoint logic

Errors at any step return the appropriate HTTP status (401, 403, 429, etc.).

## Database schema

24 tables in a libSQL (SQLite-compatible) database, managed with Drizzle ORM.

### Core tables

| Table                 | Purpose                              |
| --------------------- | ------------------------------------ |
| `users`               | User accounts with GitHub OAuth      |
| `organizations`       | Orgs with plan, billing, limits      |
| `organizationMembers` | Org membership with roles            |
| `projects`            | Projects within orgs                 |
| `projectMembers`      | Project access for non-admin members |
| `memories`            | The main memory store                |
| `memoryVersions`      | Version history for memories         |
| `memorySnapshots`     | Point-in-time snapshots              |
| `memoryLocks`         | Distributed locks                    |

### Support tables

| Table               | Purpose                         |
| ------------------- | ------------------------------- |
| `contextTypes`      | Custom context type definitions |
| `orgMemoryDefaults` | Org-wide default memories       |
| `projectTemplates`  | Reusable memory templates       |
| `sessionLogs`       | Agent session summaries         |
| `activityLogs`      | Detailed tool/action logs       |
| `apiTokens`         | Bearer tokens (hashed)          |

### Key indexes

- `memories`: composite indexes on `(projectId, updatedAt)`, `(projectId, archivedAt)`, `(projectId, priority)`, `(projectId, createdAt)`
- `activityLogs`: indexes on `(sessionId, action)`, `(projectId, action, createdAt)`
- Unique constraints: `(projectId, key)` on memories, `(orgId, slug)` on projects

### Memory record fields

```
key, content, metadata (JSON), scope, priority, tags (JSON),
relatedKeys (JSON), embedding (JSON Float32Array),
pinnedAt, archivedAt, expiresAt,
accessCount, lastAccessedAt, helpfulCount, unhelpfulCount,
version, createdBy, createdAt, updatedAt
```

## Semantic search

memctl uses a hybrid search system combining full-text search with vector embeddings.

### Embedding model

- **Model:** `all-MiniLM-L6-v2` via `@xenova/transformers`
- **Dimensions:** 384-dimensional Float32 vectors
- **Storage:** JSON-serialized in a TEXT column on the memories table
- **Runs locally** — no external API calls

Embeddings are generated asynchronously whenever a memory is created or updated. Input: `{key} {content} {tags}`.

### Hybrid search pipeline

When `?q=...` is provided:

1. **FTS5** — keyword matching on key, content, and tags
2. **Vector search** — cosine similarity against embeddings, threshold 0.3
3. **Reciprocal Rank Fusion (RRF)** — merges results: `score(id) = Σ 1/(k + rank + 1)` where k=60
4. **Weighted ranking** — final scoring by priority, access count, feedback, recency, pin status

### Relevance scoring

Used for context retrieval priority. Formula:

```
score = basePriority × usageFactor × timeFactor × feedbackFactor × pinBoost × 100

basePriority = max(priority, 1) / 100
usageFactor  = 1 + ln(1 + accessCount)
timeFactor   = e^(-0.03 × daysSinceAccess)    // ~23 day half-life
feedbackFactor = 0.5 + (helpful / totalFeedback)  // range 0.5-1.5
pinBoost     = 1.5 if pinned, else 1
```

### Similar memories

`POST /memories/similar` uses cosine similarity on embeddings, with fallback to Jaccard word overlap.

### Embedding backfill

```bash
npx tsx apps/web/scripts/backfill-embeddings.ts
```

The background scheduler also backfills every 6 hours (batches of 100).

## Caching

Three layers, detailed in [Offline & Caching](./offline-and-caching.md):

1. **In-memory** — 30s fresh TTL, 120s stale-while-revalidate
2. **ETag** — conditional requests, 304 Not Modified
3. **SQLite** — persistent offline cache at `~/.memctl/cache.db`

Request deduplication prevents duplicate in-flight GETs.

## Rate limiting

Sliding-window counter per user, backed by LRU cache. Limits set by org plan (60/min free through 10K/min scale). Returns 429 with `Retry-After` header.

## Background scheduler

Runs via `node-cron`:

| Job                    | Schedule      | Description                       |
| ---------------------- | ------------- | --------------------------------- |
| Expired memory cleanup | Hourly        | Deletes memories past `expiresAt` |
| Embedding backfill     | Every 6 hours | Generates missing embeddings      |

## Structured logging

Pino JSON logging with `X-Request-Id` correlation. Level configurable via `LOG_LEVEL` env var.

## Response compression

gzip compression via Next.js `compress: true`.

## Testing

Vitest test suites cover: cache, local cache, API client, rate limiting, ETags, cosine similarity, RRF, validators, doctor, init, session/git, tool dispatch, and relevance scoring.

```bash
pnpm test
```

See [Local Development](./local-development.md) and [Contributing](./contributing.md) for running tests.
