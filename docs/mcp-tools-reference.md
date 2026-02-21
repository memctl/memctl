# MCP Tools Reference

memctl exposes 11 MCP tools with 90+ actions. Each tool groups related functionality. The agent calls a tool by name and passes an `action` parameter to select the operation.

All tools use the same pattern:

```json
{
  "tool": "memory",
  "arguments": {
    "action": "store",
    "key": "agent/context/coding_style/general",
    "content": "Use TypeScript strict mode"
  }
}
```

---

## memory

Core memory CRUD operations. 11 actions.

### store

Store a new memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique memory key |
| `content` | string | Yes | Memory content (max 65536 chars) |
| `metadata` | object | No | Arbitrary metadata |
| `scope` | string | No | `"project"` (default) or `"shared"` |
| `priority` | number | No | 0-100 importance score |
| `tags` | array | No | String tags (max 20) |
| `expiresAt` | number | No | Unix timestamp for auto-expiry |
| `ttl` | string | No | Preset TTL: `"session"` (24h), `"pr"` (7d), `"sprint"` (14d), `"permanent"` |
| `dedupAction` | string | No | On similar match: `"warn"` (default), `"skip"`, `"merge"` |
| `autoBranch` | boolean | No | Auto-add `branch:<name>` tag if on feature branch |

Checks for similar content at 70% threshold when `dedupAction` is set. Rate limited.

```json
{
  "action": "store",
  "key": "agent/context/coding_style/typescript",
  "content": "- Use strict mode\n- Prefer interfaces over types\n- Use early returns",
  "priority": 80,
  "tags": ["coding_style", "typescript"]
}
```

### get

Retrieve a memory by key.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key to retrieve |
| `includeHints` | boolean | No | Include contextual hints (staleness, feedback, co-access) |

When `includeHints` is true, the response includes freshness indicators, feedback counts, and frequently co-accessed keys.

### search

Full-text search across memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Results limit, 1-100, default 20 |
| `sort` | string | No | `"updated"`, `"priority"`, `"created"` |
| `tags` | string | No | Comma-separated tag filter |
| `includeArchived` | boolean | No | Include archived memories |

Uses the hybrid search pipeline: FTS5 keyword matching + vector similarity + Reciprocal Rank Fusion.

### list

List memories with pagination and filtering.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Results limit, 1-100, default 100 |
| `offset` | number | No | Pagination offset |
| `sort` | string | No | `"updated"`, `"priority"`, `"created"` |
| `tags` | string | No | Comma-separated tag filter |
| `includeArchived` | boolean | No | Include archived memories |

### delete

Permanently delete a memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key to delete |

Rate limited.

### update

Update an existing memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key to update |
| `content` | string | No | New content |
| `metadata` | object | No | New metadata |
| `priority` | number | No | New priority (0-100) |
| `tags` | array | No | New tags |

Warns if other memories have `relatedKeys` referencing the updated key. Rate limited.

### pin

Pin or unpin a memory. Pinned memories are always included in bootstrap.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `pin` | boolean | Yes | `true` to pin, `false` to unpin |

### archive

Archive or unarchive a memory. Archived memories are excluded from default list/search.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `archiveFlag` | boolean | Yes | `true` to archive, `false` to unarchive |

### bulk_get

Retrieve multiple memories in a single request.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | array | Yes | Array of memory keys (max 50) |

### store_safe

Optimistic concurrency-controlled store with conflict resolution.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `content` | string | Yes | Memory content |
| `ifUnmodifiedSince` | number | Yes | Unix timestamp — reject if memory was modified after this |
| `metadata` | object | No | Metadata |
| `priority` | number | No | Priority (0-100) |
| `tags` | array | No | Tags |
| `onConflict` | string | No | `"reject"` (default), `"last_write_wins"`, `"append"`, `"return_both"` |

Use this when multiple agents might be writing to the same key concurrently.

### capacity

Get memory capacity information.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns project and org usage, limits, and status. Includes guidance text for the agent.

---

## memory_advanced

Advanced memory analysis and batch operations. 26 actions.

### batch_mutate

Apply the same action to multiple memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | array | Yes | Memory keys to mutate |
| `mutateAction` | string | Yes | One of: `archive`, `unarchive`, `delete`, `pin`, `unpin`, `set_priority`, `add_tags`, `set_scope` |
| `value` | any | No | Value for the action (e.g. priority number, tag array, scope string) |

### snapshot_create

Create an immutable snapshot of all current memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Snapshot name |
| `description` | string | No | Description |

### snapshot_list

List existing snapshots.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-500, default 10 |

### diff

Show line-by-line diff between two versions of a memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `v1` | number | Yes | First version number |
| `v2` | number | No | Second version (defaults to current) |

Returns added/removed/unchanged lines with line numbers and a summary.

### history

Get version history for a memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `limit` | number | No | 1-500, default 10 |

### restore

Restore a memory to a previous version.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `version` | number | Yes | Version number to restore |

### link

Create or remove a bidirectional link between two memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Source memory key |
| `relatedKey` | string | Yes | Target memory key |
| `unlink` | boolean | No | `true` to remove the link |

### traverse

Follow memory links up to N hops and return the connected graph.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Starting memory key |
| `depth` | number | No | 1-5, default 2 |

Returns nodes (key, content, depth) and edges (from, to).

### graph

Analyze all memory relationships across the project.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns clusters, orphan nodes (no links), cycles, and full adjacency list.

### contradictions

Find conflicting directives across memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Uses regex patterns to detect conflicts like "use X" vs "avoid X", "always do" vs "never do". Returns pairs of contradicting memories with the conflicting lines.

### quality

Score memories on quality (0-100).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-500, default 30 |

Scoring factors:

- Length — very short content scores lower
- Structure — long content without headings or lists scores lower
- Feedback — net negative feedback reduces score
- Staleness — not accessed in 60+ days reduces score
- TODO markers — unresolved TODOs flag for review

### freshness

Check if memories have changed since last check.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `cachedHash` | string | No | Previous hash to compare against |

Returns a hash of the current state. If the hash matches `cachedHash`, nothing changed.

### size_audit

Find oversized memories and estimate token counts.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `threshold` | number | No | Bytes threshold, default 4000 |

Returns memories exceeding the threshold with estimated token counts.

### sunset

Suggest memories for deletion based on multiple signals.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-500, default 20 |

Considers: deleted branches, missing file references, zero access count, net negative feedback.

### undo

Rollback a memory N versions.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `steps` | number | No | 1-50, default 1 |

Returns previous and restored content with version numbers.

### compile

Build an optimized context document from filtered memories within a token budget.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `types` | array | No | Filter by context types |
| `branch` | string | No | Filter by branch tag |
| `tags` | array | No | Filter by tags |
| `maxTokens` | number | No | 100-200000, default 16000 |
| `format` | string | No | `"markdown"` (default) or `"condensed"` |

Prioritizes pinned memories, high-priority entries, and constraint types. Respects the token budget.

### change_digest

Get a summary of all changes since a timestamp.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `since` | number | Yes | Unix timestamp |
| `limit` | number | No | 1-500, default 100 |

Returns created/updated/deleted counts and detailed change list.

### impact

Find all memories that reference a given key.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |

Checks content and `relatedKeys` fields across all project memories.

### watch

Check if specific keys were modified since a timestamp.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | array | Yes | Memory keys to check |
| `since` | number | Yes | Unix timestamp |

Returns changed keys (with content preview) and unchanged keys.

### check_duplicates

Find similar or duplicate memories by content similarity.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Content to check against |
| `excludeKey` | string | No | Key to exclude from results |
| `threshold` | number | No | 0-1, default 0.6 |

Uses vector similarity (cosine) with fallback to Jaccard word overlap.

### auto_tag

Suggest tags for a memory based on content analysis.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `apply` | boolean | No | Apply suggested tags immediately |

Detects keywords for tags like: react, typescript, database, auth, testing, etc.

### validate_schema

Validate memories against custom type schemas.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Validate memories of a specific type |
| `key` | string | No | Validate a single memory |

Checks required fields defined in custom context type schemas.

### branch_filter

Show memories tagged with a specific branch, or list all branch tag distributions.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name to filter by |

Without a branch param, returns a count of memories per branch tag.

### branch_merge

Promote or archive branch-specific memories after a branch merge.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | Yes | Branch name |
| `mergeAction` | string | Yes | `"promote"` (remove branch tag, keep globally) or `"archive"` |
| `dryRun` | boolean | No | Preview without making changes |

### batch_ops

Execute multiple API operations in a single request.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `operations` | array | Yes | Array of operations (max 20) |

Each operation: `{ "method": "GET"|"POST"|"PATCH"|"DELETE", "path": "/memories/my-key", "body": {} }`.

---

## memory_lifecycle

Lifecycle management, cleanup, and health monitoring. 11 actions.

### cleanup

Remove all expired memories (past their `expiresAt`).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

### suggest_cleanup

Suggest stale and expired memories for review.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `staleDays` | number | No | 1-365, default 30 |
| `limit` | number | No | 1-200, default 20 |

### lifecycle_run

Run specific lifecycle policies.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `policies` | array | Yes | Policy names to run |
| `mergedBranches` | array | No | Branch names for `archive_merged_branches` |
| `sessionLogMaxAgeDays` | number | No | 1-365, max age for session log cleanup |

Available policies: `archive_merged_branches`, `cleanup_expired`, `cleanup_session_logs`, `auto_promote`, `auto_demote`.

### lifecycle_schedule

Run scheduled lifecycle tasks with auto-promotion and demotion.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionLogMaxAgeDays` | number | No | 1-365, default 30 |
| `accessThreshold` | number | No | Access count for auto-promote, default 10 |
| `feedbackThreshold` | number | No | Helpful count for auto-promote, default 3 |

### validate_references

Check that file paths referenced in memories still exist in the repository.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Uses `git ls-files` to get the current file list, then scans memory content for file path references.

### prune_stale

Find memories referencing deleted files.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `archiveStale` | boolean | No | Archive memories with missing references |

### feedback

Record helpful/unhelpful feedback for a memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `helpful` | boolean | Yes | `true` for helpful, `false` for unhelpful |

### analytics

Get memory usage analytics.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns: total memories, access patterns, most/least accessed, never accessed, by-scope breakdown, by-tag counts, pinned count, average age.

### lock

Acquire a distributed lock on a memory.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `lockedBy` | string | No | Lock owner identifier |
| `ttlSeconds` | number | No | 5-600, default 60 |

### unlock

Release a distributed lock.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Memory key |
| `lockedBy` | string | No | Lock owner identifier |

### health

Score memory health on a 0-100 scale.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-200, default 50 |

Factors: recency, access frequency, feedback ratio, data integrity. Flags unhealthy entries for review.

---

## context

Agent context assembly and retrieval. 14 actions.

### bootstrap

Full context assembly for agent startup.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `includeContent` | boolean | No | Include full content, default true |
| `types` | array | No | Filter by context types |
| `branch` | string | No | Filter by branch tag |

Returns all agent context entries grouped by type, branch plan (if on a feature branch), and capacity info. Branch-specific context is sorted to the top. If context is empty but the org has defaults, includes a hint to apply them.

### bootstrap_compact

Lightweight bootstrap without full content.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns count-only summaries: entry count per type, content length, feedback scores. Useful for deciding whether to do a full bootstrap.

### bootstrap_delta

Get changes since the last bootstrap.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `since` | number | Yes | Unix timestamp of last bootstrap |

Returns created, updated, and deleted memories since the given timestamp. Use this for incremental context updates instead of re-bootstrapping.

### functionality_get

Get all entries of a context type, or a specific entry by ID.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Context type slug |
| `id` | string | No | Specific entry ID |
| `includeContent` | boolean | No | Include full content, default true |
| `followLinks` | boolean | No | Include linked memories |

### functionality_set

Store or update a context entry.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Context type slug |
| `id` | string | Yes | Entry ID (slugified) |
| `content` | string | Yes | Entry content |
| `title` | string | No | Display title |
| `metadata` | object | No | Metadata |
| `priority` | number | No | 0-100 |
| `tags` | array | No | Tags |

Stores as key `agent/context/{type}/{id}`.

### functionality_delete

Delete a context entry.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Context type slug |
| `id` | string | Yes | Entry ID |

### functionality_list

List all context entries, optionally filtered by type.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | No | Filter by type |
| `includeContentPreview` | boolean | No | Include 240-char content preview |
| `limitPerType` | number | No | Max entries per type, default 20 |

### context_for

Find relevant context entries for given file paths.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `filePaths` | array | Yes | File paths being modified |
| `types` | array | No | Filter by context types |

Scores entries by filename matches and path component overlap. Returns the most relevant context for the files you're about to modify.

### budget

Select optimal context entries within a token budget.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `maxTokens` | number | Yes | 100-200000 token budget |
| `types` | array | No | Filter by types |
| `includeKeys` | array | No | Always include these keys |

Uses efficiency scoring: `(priority*2 + accessCount*2 + helpful*3 + recency + isPinned*30) / estimatedTokens`. Returns the best entries that fit within the budget.

### compose

Build context for a specific task description.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `task` | string | Yes | Natural language task description |
| `maxTokens` | number | No | Token budget, default 8000 |
| `includeRelated` | boolean | No | Follow linked entries, default true |

Matches task keywords against memory content and keys. Boosts scores for `constraints`, `lessons_learned`, and `coding_style` types. Follows links to include related context.

### smart_retrieve

Find relevant memories by natural language intent and file patterns.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | string | Yes | What you're trying to do |
| `files` | array | No | File paths for additional matching |
| `followLinks` | boolean | No | Include linked entries, default true |
| `maxResults` | number | No | 1-20, default 5 |

Combines intent-based search with file-based context matching.

### search_org

Search across all projects in the organization.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | 1-200, default 50 |

Returns results grouped by project. Useful for finding patterns or decisions across the org.

### rules_evaluate

Find conditional context rules that match the current work context.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `filePaths` | array | No | File paths to match against |
| `taskType` | string | No | Task type to match against |
| `branch` | string | No | Branch pattern to match against |

Evaluates file glob patterns, branch patterns, and task type patterns defined in context entries.

### thread

Analyze recent session logs to find hot keys.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionCount` | number | No | 1-10 sessions to analyze, default 3 |

Returns frequently read/written keys across recent sessions. Helps identify which memories are critical to current work.

---

## context_config

Manage context type definitions and templates. 4 actions.

### type_create

Create a custom context type.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | URL-safe identifier |
| `label` | string | Yes | Display name |
| `description` | string | Yes | What this type is for |

Cannot override built-in types.

### type_list

List all context types (built-in and custom).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Built-in types: `coding_style`, `folder_structure`, `file_map`, `architecture`, `workflow`, `testing`, `branch_plan`, `constraints`, `lessons_learned`.

### type_delete

Delete a custom context type.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | Type slug to delete |

Cannot delete built-in types.

### template_get

Get a markdown template for a context type.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Context type slug |

Built-in templates available for: `coding_style`, `architecture`, `testing`, `constraints`, `lessons_learned`, `workflow`, `folder_structure`, `file_map`. Custom types get a generic template.

---

## branch

Branch-specific context management. 3 actions.

### get

Get the branch implementation plan.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name (auto-detected from git if omitted) |
| `includeRelatedContext` | boolean | No | Find context entries related to this branch's topic |

Returns the plan content, status, and checklist with progress. When `includeRelatedContext` is true, splits the branch name into terms and scores context entries by term matches.

### set

Store or update a branch implementation plan.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name (auto-detected if omitted) |
| `content` | string | Yes | Plan content |
| `metadata` | object | No | Additional metadata |
| `status` | string | No | `"planning"`, `"in_progress"`, `"review"`, `"merged"` |
| `checklist` | array | No | Array of `{ "item": "...", "done": true/false }` |

Stored under key `branch_plan:<branch_name>` with `scope: "agent_functionality"`.

### delete

Delete a branch plan.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name (auto-detected if omitted) |

---

## session

Session lifecycle and handoff management. 6 actions.

### start

Initialize a new agent session.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Unique session identifier |
| `autoExtractGit` | boolean | No | Extract git context automatically, default true |

Returns:

- **Handoff** from the previous session (summary, branch, written keys, end time)
- **Git context** (if `autoExtractGit` is true): recent commits, diff stats, TODOs/FIXMEs

Git context extraction runs `git log`, `git diff --stat`, and greps for TODO/FIXME/HACK/XXX in recently changed files. Results are stored as auto-expiring memories (`auto:git-changes:*` with 7-day TTL, `auto:todos:*` with 14-day TTL).

### end

End a session and save a handoff summary.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session identifier |
| `summary` | string | Yes | What was accomplished, decisions made, open questions |
| `keysRead` | array | No | Memory keys that were read |
| `keysWritten` | array | No | Memory keys that were written |
| `toolsUsed` | array | No | Tool names that were used |

The summary is saved for the next session's `start` call to pick up as handoff.

### history

Get previous session logs.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-50, default 10 |

Returns session summaries with branches, key access patterns, and timestamps.

### claims_check

Check if any active sessions have claimed specific keys.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `keys` | array | Yes | Keys to check |
| `excludeSession` | string | No | Session ID to exclude from check |

Use this to detect potential write conflicts with other active sessions.

### claim

Reserve keys for exclusive access in this session.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Your session ID |
| `keys` | array | Yes | Keys to claim |
| `ttlMinutes` | number | No | Lock duration, default 30 |

Claims expire after the TTL. Use with `claims_check` for distributed coordination.

### rate_status

Show current rate limit usage.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns calls made, remaining quota, percentage used, and status.

---

## import_export

Import and export agent context and memories. 4 actions.

### agents_md_import

Parse and import an AGENTS.md file.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | AGENTS.md file content |
| `dryRun` | boolean | No | Preview only, don't import |
| `overwrite` | boolean | No | Overwrite existing keys (default: skip) |

Parses sections by heading. Maps 50+ heading patterns to context types (e.g. "Coding Style" -> `coding_style`, "Architecture" -> `architecture`).

### cursorrules_import

Import from Cursor rules or Copilot instructions format.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | File content |
| `source` | string | No | `"cursorrules"` or `"copilot"` |
| `dryRun` | boolean | No | Preview only |
| `overwrite` | boolean | No | Overwrite existing keys |

### export_agents_md

Export agent context entries in a specified format.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | No | `"agents_md"` (default), `"cursorrules"`, `"json"` |

### export_memories

Export all memories in a specified format.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | No | `"agents_md"` (default), `"cursorrules"`, `"json"` |

---

## repo

Repository scanning and onboarding. 3 actions.

### scan

List git-tracked files in the repository.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `maxFiles` | number | No | 10-5000, default 1000 |
| `includePatterns` | array | No | Glob patterns to include |
| `excludePatterns` | array | No | Glob patterns to exclude |
| `saveAsContext` | boolean | No | Save result as a `file_map` context entry |

Groups files by directory and extension. Useful for initial project understanding.

### scan_check

Compare the stored file map to the current repository state.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Reports added and deleted files since the last scan. Suggests a rescan if the file map is stale.

### onboard

Auto-detect tech stack and generate context suggestions.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `apply` | boolean | No | Apply suggestions to memory immediately |

Detects from project files:

- **Language**: TypeScript, JavaScript
- **Framework**: Next.js, React, Vue, Nuxt, SvelteKit, Express, Fastify, Hono
- **Package manager**: npm, pnpm, bun, yarn
- **Test runner**: jest, vitest, mocha
- **Linter**: ESLint, Biome
- **Formatter**: Prettier
- **Monorepo**: workspaces detection
- **Container**: Docker
- **CI/CD**: GitHub Actions

Generates context suggestions for: `coding_style` (p80), `architecture` (p75), `testing` (p70), `folder_structure` (p65), `workflow` (p60).

---

## org

Organization-level defaults and templates. 7 actions.

### defaults_list

List org-wide default memories.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

### defaults_set

Set an org default that can be applied to any project.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Default memory key |
| `content` | string | Yes | Content |
| `metadata` | object | No | Metadata |
| `priority` | number | No | 0-100 |
| `tags` | array | No | Tags |

### defaults_apply

Apply all org defaults to the current project.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns count of memories created and updated.

### context_diff

Compare agent context between two projects.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectA` | string | Yes | First project slug |
| `projectB` | string | Yes | Second project slug |

Returns keys unique to each project, shared keys, and whether shared keys have matching content.

### template_list

List available project templates.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns both built-in and custom templates.

### template_apply

Apply a template to the current project.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `templateId` | string | Yes | Template ID |

Returns count of memories created and updated.

### template_create

Create a reusable project template.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name |
| `data` | array | Yes | Array of memory entries: `{ key, content, metadata, priority, tags }` |
| `description` | string | No | Template description |

---

## activity

Activity logging and memos. 4 actions.

### log

Get activity logs.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | 1-200, default 50 |
| `sessionId` | string | No | Filter by session |

### generate_git_hooks

Generate shell scripts for git hooks.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `hooks` | array | Yes | Hook names: `"pre-commit"`, `"post-checkout"`, `"prepare-commit-msg"` |

Returns shell scripts with installation instructions. Generated hooks:

- **pre-commit**: Reminds to check agent context before committing
- **post-checkout**: Notifies on branch switch, reminds to load branch plan
- **prepare-commit-msg**: Adds branch name comment to commit message

### memo_leave

Leave a message for the next agent session.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Memo content |
| `urgency` | string | No | `"info"` (p30, 3d TTL), `"warning"` (p60, 3d TTL), `"blocker"` (p90, 7d TTL) |
| `relatedKeys` | array | No | Related memory keys |

Stored as `agent/memo/<timestamp_base36>` with the `memo` tag and urgency tag.

### memo_read

Read all memos from previous sessions.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| (none) | | | |

Returns memos sorted by urgency (blockers first). Memos auto-expire based on their urgency level.
