# REST API Reference

The memctl API is served at `/api/v1/` (default: `https://memctl.com/api/v1`). All endpoints return JSON.

## Authentication

All endpoints (except `GET /health`) require a Bearer token:

```
Authorization: Bearer <your-api-token>
```

Tokens are created in the dashboard under Settings > API Tokens, or via `POST /api/v1/tokens`.

## Required headers

Every authenticated request must include:

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <token>` |
| `Content-Type` | `application/json` (for POST/PATCH/DELETE with body) |
| `X-Org-Slug` | Organization slug |
| `X-Project-Slug` | Project slug |

## Rate limiting

Rate limits are per-user, based on the organization's plan:

| Plan | Requests/min |
|------|-------------|
| Free | 60 |
| Lite | 300 |
| Pro | 1,000 |
| Business | 3,000 |
| Scale | 10,000 |
| Enterprise | Unlimited |

When exceeded, the API returns `429 Too Many Requests` with headers:

```
Retry-After: 15
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
```

## Pagination

List endpoints support `limit` and `offset` query parameters:

```
GET /memories?limit=20&offset=40
```

Some endpoints also support cursor-based pagination with `after`:

```
GET /memories?limit=20&after=<last-key>
```

## ETags

Memory endpoints return `ETag` headers. Send `If-None-Match` on GETs for conditional requests:

```bash
curl -H "If-None-Match: \"abc123\"" https://memctl.com/api/v1/memories
# Returns 304 Not Modified if unchanged
```

Send `If-Match` on PATCH/DELETE for optimistic concurrency:

```bash
curl -X PATCH -H "If-Match: \"abc123\"" ...
# Returns 412 Precondition Failed if the ETag doesn't match
```

## Response format

Successful responses:

```json
{ "memory": { "key": "...", "content": "..." } }
```

Error responses:

```json
{ "error": "Description of what went wrong" }
```

Every response includes an `X-Request-Id` header for debugging.

---

## Endpoints

### Health

#### GET /health

Health check. No auth required.

```bash
curl https://memctl.com/api/v1/health
```

---

### Memories

#### GET /memories

List or search memories.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `q` | string | — | Search query (enables hybrid search) |
| `limit` | number | 20 | Max results (1-100) |
| `offset` | number | 0 | Pagination offset |
| `after` | string | — | Cursor-based pagination |
| `sort` | string | — | `updated`, `priority`, `created` |
| `tags` | string | — | Comma-separated tag filter |
| `include_archived` | boolean | false | Include archived |

```bash
# List
curl -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Slug: my-org" -H "X-Project-Slug: my-project" \
  "https://memctl.com/api/v1/memories?limit=20"

# Search
curl ... "https://memctl.com/api/v1/memories?q=authentication&limit=10"
```

#### POST /memories

Create a memory.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Org-Slug: my-org" -H "X-Project-Slug: my-project" \
  -d '{
    "key": "agent/context/coding_style/general",
    "content": "Use TypeScript strict mode",
    "priority": 80,
    "tags": ["coding_style"],
    "scope": "project"
  }' \
  https://memctl.com/api/v1/memories
```

Body fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique key (1-256 chars) |
| `content` | string | Yes | Content (1-65536 chars) |
| `metadata` | object | No | Arbitrary metadata |
| `scope` | string | No | `"project"` or `"shared"` |
| `priority` | number | No | 0-100 |
| `tags` | array | No | String tags (max 20) |
| `expiresAt` | number | No | Unix timestamp |

#### GET /memories/{key}

Get a single memory by key.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Slug: my-org" -H "X-Project-Slug: my-project" \
  https://memctl.com/api/v1/memories/agent%2Fcontext%2Fcoding_style%2Fgeneral
```

Key must be URL-encoded.

#### PATCH /memories/{key}

Update a memory.

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Org-Slug: my-org" -H "X-Project-Slug: my-project" \
  -d '{"content": "Updated content", "priority": 90}' \
  https://memctl.com/api/v1/memories/agent%2Fcontext%2Fcoding_style%2Fgeneral
```

#### DELETE /memories/{key}

Delete a memory.

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Slug: my-org" -H "X-Project-Slug: my-project" \
  https://memctl.com/api/v1/memories/agent%2Fcontext%2Fcoding_style%2Fgeneral
```

#### POST /memories/bulk

Get multiple memories by keys.

```json
{ "keys": ["key1", "key2", "key3"] }
```

Returns `{ "memories": {...}, "found": 3, "requested": 3 }`.

#### POST /memories/batch

Batch mutation. Apply the same action to multiple keys.

```json
{ "keys": ["key1", "key2"], "action": "archive" }
```

Actions: `archive`, `unarchive`, `delete`, `pin`, `unpin`, `set_priority`, `add_tags`, `set_scope`.

#### GET /memories/capacity

Get memory capacity for the project and org.

Returns: `used`, `limit`, `orgUsed`, `orgLimit`, `isFull`, `isApproaching`, `usageRatio`.

#### POST /memories/similar

Find similar memories by content.

```json
{ "content": "How to handle errors", "threshold": 0.6, "excludeKey": "my-key" }
```

#### POST /memories/watch

Check if keys changed since a timestamp.

```json
{ "keys": ["key1", "key2"], "since": 1708556400 }
```

#### POST /memories/pin

Pin or unpin a memory.

```json
{ "key": "my-key", "pin": true }
```

#### POST /memories/archive

Archive or unarchive.

```json
{ "key": "my-key", "archive": true }
```

#### DELETE /memories/archive

Clean up all expired memories. Returns `{ "cleaned": <count> }`.

#### POST /memories/link

Link or unlink two memories.

```json
{ "key": "key-a", "relatedKey": "key-b", "unlink": false }
```

#### POST /memories/feedback

Record feedback.

```json
{ "key": "my-key", "helpful": true }
```

#### POST /memories/rollback

Rollback to a previous version.

```json
{ "key": "my-key", "steps": 1 }
```

#### POST /memories/lock

Acquire a lock.

```json
{ "key": "my-key", "lockedBy": "session-123", "ttlSeconds": 60 }
```

#### DELETE /memories/lock

Release a lock.

```json
{ "key": "my-key", "lockedBy": "session-123" }
```

#### GET /memories/versions

Get version history.

```
GET /memories/versions?key=my-key&limit=10
```

#### POST /memories/versions

Restore a specific version.

```json
{ "key": "my-key", "version": 3 }
```

#### GET /memories/diff

Compare two versions.

```
GET /memories/diff?key=my-key&v1=1&v2=3
```

#### GET /memories/traverse

Graph traversal from a key.

```
GET /memories/traverse?key=my-key&depth=2
```

#### GET /memories/co-accessed

Find commonly co-accessed memories.

```
GET /memories/co-accessed?key=my-key&limit=5
```

#### GET /memories/health

Get health scores for memories.

```
GET /memories/health?limit=50
```

#### GET /memories/analytics

Get usage analytics.

#### GET /memories/freshness

Check if data has changed (hash-based).

#### GET /memories/changes

Get change digest.

```
GET /memories/changes?since=1708556400&limit=100
```

#### GET /memories/delta

Get incremental changes for sync.

```
GET /memories/delta?since=1708556400
```

#### GET /memories/suggest-cleanup

Get cleanup suggestions.

```
GET /memories/suggest-cleanup?stale_days=30&limit=20
```

#### GET /memories/export

Export memories.

```
GET /memories/export?format=agents_md
```

Formats: `agents_md`, `cursorrules`, `json`.

#### POST /memories/lifecycle

Run lifecycle policies.

```json
{ "policies": ["cleanup_expired", "auto_promote"] }
```

#### POST /memories/lifecycle/schedule

Run scheduled lifecycle with thresholds.

```json
{ "sessionLogMaxAgeDays": 30, "accessThreshold": 10, "feedbackThreshold": 3 }
```

#### POST /memories/validate

Validate file references.

```json
{ "repoFiles": ["src/index.ts", "src/auth.ts", "..."] }
```

#### POST /memories/snapshots

Create or list snapshots.

```json
{ "name": "before-refactor", "description": "Pre-refactor state" }
```

#### GET /memories/snapshots

List snapshots.

```
GET /memories/snapshots?limit=20
```

#### GET /memories/search-org

Search across all org projects.

```
GET /memories/search-org?q=authentication&limit=50
```

#### GET /memories/org-diff

Compare context between two projects.

```
GET /memories/org-diff?project_a=backend&project_b=frontend
```

---

### Session Logs

#### GET /session-logs

List session logs.

```
GET /session-logs?limit=20
```

#### POST /session-logs

Create or update a session log.

```json
{
  "sessionId": "session-abc",
  "branch": "feature/auth",
  "summary": "Refactored auth flow",
  "keysRead": ["key1"],
  "keysWritten": ["key2"],
  "toolsUsed": ["memory", "context"]
}
```

---

### Activity Logs

#### GET /activity-logs

List activity logs.

```
GET /activity-logs?limit=50&session_id=session-abc
```

#### POST /activity-logs

Log an activity.

```json
{
  "action": "memory.store",
  "sessionId": "session-abc",
  "toolName": "memory",
  "memoryKey": "my-key",
  "details": { "reason": "New coding style entry" }
}
```

---

### Context Types

#### GET /context-types

List all context types (built-in + custom).

#### POST /context-types

Create a custom context type.

```json
{ "slug": "api_conventions", "label": "API Conventions", "description": "REST patterns" }
```

#### DELETE /context-types/{slug}

Delete a custom context type.

---

### Org Defaults

#### GET /org-defaults

List organization default memories.

#### POST /org-defaults

Set an org default.

```json
{ "key": "coding-standard", "content": "...", "priority": 80 }
```

#### DELETE /org-defaults

Delete an org default.

```json
{ "key": "coding-standard" }
```

#### POST /org-defaults/apply

Apply all org defaults to the current project.

---

### Project Templates

#### GET /project-templates

List templates.

#### POST /project-templates

Create a template or apply one.

Create:

```json
{ "name": "React Starter", "description": "...", "data": [{ "key": "...", "content": "..." }] }
```

Apply:

```json
{ "apply": true, "templateId": "template-id" }
```

---

### Organizations

#### GET /orgs

List organizations the user belongs to.

#### POST /orgs

Create an organization.

```json
{ "name": "My Team", "slug": "my-team" }
```

#### GET /orgs/{slug}

Get organization details.

#### GET /orgs/{slug}/members

List members.

#### POST /orgs/{slug}/members

Invite a member.

```json
{ "email": "dev@example.com", "role": "member" }
```

#### GET /orgs/{slug}/stats

Get organization statistics.

#### POST /orgs/{slug}/checkout

Create a Stripe checkout session.

#### POST /orgs/{slug}/portal

Create a Stripe customer portal session.

---

### Projects

#### GET /projects

List projects in the org.

#### POST /projects

Create a project.

```json
{ "name": "Backend API", "slug": "backend-api" }
```

#### GET /projects/{slug}

Get project details.

#### PATCH /projects/{slug}

Update a project.

---

### API Tokens

#### POST /auth/token

Generate an API token (used by the MCP server).

#### GET /tokens

List API tokens.

#### POST /tokens

Create an API token.

```json
{ "name": "dev-token", "expiresAt": 1740000000 }
```

---

### Batch Operations

#### POST /batch

Execute multiple API operations in a single request.

```json
{
  "operations": [
    { "method": "GET", "path": "/memories/key1" },
    { "method": "POST", "path": "/memories", "body": { "key": "key2", "content": "..." } }
  ]
}
```

Max 20 operations per batch.
