# Architecture & Infrastructure

This document covers the infrastructure features behind memctl's API and CLI: semantic search, caching, offline mode, rate limiting, webhooks, background jobs, and observability.

---

## Semantic Search (Embeddings)

memctl uses a **hybrid search** system combining full-text search (FTS5) with vector embeddings for semantic similarity.

### Embedding Model

- **Model:** [`all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) via [`@xenova/transformers`](https://github.com/xenova/transformers.js)
- **Dimensions:** 384-dimensional Float32 vectors
- **Storage:** JSON-serialized `Float32Array` in a nullable `TEXT` column on the `memories` table
- **Runs locally** — no external API calls, no data leaves the server

### How Embeddings Are Generated

Embeddings are generated **asynchronously** (fire-and-forget) whenever a memory is created or updated. The input text is:

```
{key} {content} {tags joined by space}
```

This runs in the background so it never blocks the API response.

### Hybrid Search Pipeline

When a search query (`?q=...`) is provided on `GET /api/v1/memories`:

1. **FTS5 keyword search** — matches on `key`, `content`, and `tags` fields
2. **Vector search** — generates an embedding for the query, computes cosine similarity against all project memories with embeddings, filters results above a 0.3 similarity threshold
3. **Reciprocal Rank Fusion (RRF)** — merges both result sets using RRF scoring (`k=60`): `score(id) = Σ 1/(k + rank + 1)` for each ranked list
4. **Weighted ranking** — final results are scored by priority, access count, feedback, recency, and pin status

This means searching for "login flow" will match a memory keyed "authentication-system" even though the words don't overlap.

### Similar Memories

`GET /api/v1/memories/similar` uses cosine similarity on embeddings when available, with a fallback to Jaccard word overlap for memories without embeddings.

### Backfilling Embeddings

For existing memories that were created before embeddings were added:

```bash
npx tsx apps/web/scripts/backfill-embeddings.ts
```

This processes memories in batches of 50. The background scheduler also backfills stale embeddings every 6 hours.

---

## Caching

### Client-Side Cache (CLI)

The MCP CLI client maintains an **in-memory TTL cache** (`packages/cli/src/cache.ts`):

- Default TTL: 30 seconds
- Caches GET responses keyed by `GET:{path}`
- Stores ETags alongside cached data for revalidation
- Automatically invalidated on write operations (POST/PATCH/DELETE to `/memories*`)

### ETags & Conditional Requests

The API generates ETags (MD5 hash of response body) on memory GET endpoints. The CLI sends `If-None-Match` headers on requests where it has a cached ETag. On match, the API returns `304 Not Modified` — no response body is transferred.

Supported endpoints:
- `GET /api/v1/memories` (list/search)
- `GET /api/v1/memories/{key}` (single memory)

---

## Offline Mode

When the API is unreachable, the CLI falls back to a **local SQLite cache** (`packages/cli/src/local-cache.ts`).

### How It Works

- Uses `better-sqlite3` for a local DB at `~/.memctl/cache.db`
- Falls back to an in-memory `Map` when `better-sqlite3` is not available
- On startup, the CLI pings the API — if unreachable, it logs a warning and enters offline mode
- GET requests that fail due to network errors return data from the local cache
- The local cache is synced in the background after successful API responses
- Staleness threshold: 5 minutes (after which the cache is considered stale)

### Pending Writes

Write operations attempted while offline are queued to `~/.memctl/pending-writes.json`. These are replayed when connectivity is restored.

### Connection Status

The CLI exposes a `memctl://connection-status` MCP resource that reports whether the client is online or offline.

---

## Rate Limiting

API rate limiting uses a **sliding-window counter** backed by an LRU cache (`apps/web/lib/rate-limit.ts`).

### Limits by Plan

| Plan | Requests/minute |
|------|----------------|
| Free | 60 |
| Lite | 300 |
| Pro | 1,000 |
| Business | 3,000 |
| Scale | 10,000 |
| Enterprise | Unlimited |

When exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header indicating seconds until the window resets.

Rate limiting is checked after authentication in the API middleware pipeline.

---

## Webhooks

memctl supports webhook notifications for memory events (`apps/web/lib/webhook-dispatch.ts`).

### Event Types

- `memory.created` — a new memory was stored
- `memory.updated` — an existing memory was modified
- `memory.deleted` — a memory was deleted

### Delivery

Events are stored in the `webhookEvents` table for **digest-mode delivery**. A background job (every 15 minutes) batches undispatched events per webhook config and sends them as a single HTTP POST.

### Security

Each webhook delivery includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the request body, signed with the webhook config's secret. Receivers should verify this signature to authenticate events.

Payload format:

```json
{
  "events": [
    { "type": "memory.created", "payload": { "key": "...", "projectId": "..." } }
  ],
  "timestamp": "2026-02-20T12:00:00.000Z"
}
```

---

## Background Scheduler

Periodic jobs run via `node-cron` (`apps/web/lib/scheduler.ts`), initialized through Next.js instrumentation:

| Job | Schedule | Description |
|-----|----------|-------------|
| Expired memory cleanup | Hourly (`0 * * * *`) | Deletes memories past their `expiresAt` date |
| Webhook digest dispatch | Every 15 min (`*/15 * * * *`) | Sends batched webhook events |
| Embedding backfill | Every 6 hours (`0 */6 * * *`) | Generates embeddings for memories missing them (batches of 100) |

---

## Structured Logging

The API uses [Pino](https://github.com/pinojs/pino) for JSON-structured logging (`apps/web/lib/logger.ts`).

- Each request gets a unique `X-Request-Id` header
- Log level is configurable via `LOG_LEVEL` env var (default: `info`)
- Output format: JSON with ISO timestamps

---

## Response Compression

The Next.js server has `compress: true` enabled in `next.config.ts`, which applies gzip compression to API responses.

---

## Testing

Tests use [Vitest](https://vitest.dev/) and can be run from the project root:

```bash
pnpm test
```

Test suites cover:
- CLI cache (TTL, ETag storage, invalidation)
- Local SQLite cache (sync, search, offline reads, pending writes)
- API client (caching, ETag revalidation, offline fallback)
- Rate limiting (sliding window, plan tiers, 429 responses)
- ETag generation and conditional requests
- Cosine similarity math
- Hybrid search merging (RRF)
- Webhook HMAC signatures
- Zod schema validators
