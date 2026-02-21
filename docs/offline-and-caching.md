# Offline & Caching

memctl has three cache layers that work together to minimize API calls and keep things working when the network is unavailable.

## Cache layers

### 1. In-memory cache

**Location:** Process memory (inside the MCP server process)
**Implementation:** `packages/cli/src/cache.ts`

A TTL-based cache for GET responses:

- **Fresh window:** 30 seconds — cached data is served directly, no API call
- **Stale window:** 30s to 150s — cached data is served immediately, API is revalidated in the background (stale-while-revalidate pattern)
- **Expired:** After 150s — cache entry is gone, next request hits the API

The cache key format is `GET:{api_path}`.

On any write operation (POST, PATCH, DELETE to `/memories*`), all GET caches with the `/memories` prefix are invalidated.

**Request deduplication:** If two identical GET requests happen at the same time, only one API call is made. The second request shares the first one's promise.

### 2. ETag revalidation

The API generates ETags (MD5 of response body) on memory endpoints. The client stores ETags alongside cached data.

On subsequent requests:

- **GET:** Sends `If-None-Match: <etag>` header. If the data hasn't changed, the API returns `304 Not Modified` with no body — saving bandwidth.
- **PATCH/DELETE:** Sends `If-Match: <etag>` header for optimistic concurrency control.

After a 304 response, the cache entry's TTL is refreshed.

### 3. Local SQLite cache

**Location:** `~/.memctl/cache.db`
**Implementation:** `packages/cli/src/local-cache.ts`

A persistent SQLite database (via `better-sqlite3`) that stores memories for offline access.

Schema:

```
cached_memories:
  key TEXT
  content TEXT
  metadata TEXT
  tags TEXT
  priority INTEGER
  project TEXT
  org TEXT
  updated_at INTEGER
  PRIMARY KEY (org, project, key)
```

The cache is populated in the background whenever the API returns memory data. It syncs on every successful GET to `/memories*`.

**Staleness:** The cache is considered stale after 5 minutes without a sync. The `isStale()` method checks this.

**Fallback:** If `better-sqlite3` is not available (e.g. in some environments), falls back to an in-memory `Map` that provides the same API but doesn't persist across restarts.

## Offline mode

### How it works

On startup, the MCP server pings the API (`GET /health` with 5-second timeout):

- **Online:** Normal operation. If there's a previous sync timestamp, runs an incremental sync (see below). Otherwise, fetches up to 100 memories to populate the local cache.
- **Offline:** Logs a warning to stderr and enters offline mode.

In offline mode:

- GET requests that fail due to network errors fall back to the local SQLite cache
- Write operations (POST, PATCH, DELETE) are queued to a pending writes file
- The `memctl://connection-status` resource reports `{ "online": false }`

### Freshness indicators

The API client tracks a freshness state for each response:

| State | Meaning |
|-------|---------|
| `fresh` | Data came from the API just now |
| `cached` | Data came from the in-memory cache (or 304 revalidation) |
| `stale` | Data came from stale cache; background revalidation in progress |
| `offline` | Data came from the local SQLite cache |

## Pending writes

**Location:** `~/.memctl/pending-writes.json`

When a write operation fails due to a network error, it's queued:

```json
[
  {
    "method": "POST",
    "path": "/memories",
    "body": { "key": "...", "content": "..." },
    "timestamp": 1708556400000
  }
]
```

Pending writes are replayed when connectivity is restored. The `memctl doctor` command checks for queued writes and reports them.

Currently, pending writes are not replayed automatically — they require a manual sync or the next successful API call to trigger replay.

## Incremental sync

On startup (when online), if the local cache has a previous sync timestamp, the client fetches only changes since then:

```
GET /api/v1/memories/delta?since={timestamp}
```

The response contains:

- `created` — new memories
- `updated` — modified memories
- `deleted` — removed memory keys

These are applied to the local SQLite cache. The sync timestamp is updated.

This is much faster than re-fetching everything on every startup.

## Cache invalidation

Writes invalidate the in-memory cache:

| Operation | Invalidation |
|-----------|-------------|
| `POST /memories` | All `GET:/memories*` cache entries |
| `PATCH /memories/{key}` | All `GET:/memories*` cache entries |
| `DELETE /memories/{key}` | All `GET:/memories*` cache entries |

The local SQLite cache is not invalidated by writes — it's updated via the next successful GET sync.

## Connection status

Check whether the client is online:

- **MCP resource:** `memctl://connection-status` returns `{ "online": true/false }`
- **Session tool:** `rate_status` action includes connection info
- **Doctor command:** `memctl doctor` checks API reachability

## Configuration

There are no user-configurable cache settings. The TTLs and thresholds are:

| Setting | Value | Location |
|---------|-------|----------|
| In-memory cache fresh TTL | 30 seconds | `cache.ts` constructor default |
| In-memory cache stale TTL | 120 seconds | `cache.ts` constructor default |
| Local cache stale threshold | 5 minutes | `local-cache.ts` |
| API ping timeout | 5 seconds | `api-client.ts` |

These are hardcoded defaults. If you need different values, modify the source.
