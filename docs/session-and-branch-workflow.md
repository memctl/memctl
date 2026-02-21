# Session & Branch Workflow

memctl tracks agent sessions for continuity between conversations and manages branch-specific context for feature work.

## Session lifecycle

### Starting a session

Every agent session should start by calling `session` with `start`:

```json
{
  "tool": "session",
  "action": "start",
  "sessionId": "session-2024-02-21-abc123"
}
```

This returns:

- **Handoff** from the previous session — summary text, branch name, keys written, when it ended
- **Git context** (if `autoExtractGit` is true, which is the default)

The session ID should be unique. Most IDE integrations generate one automatically.

### Git context extraction

On `session_start`, memctl automatically runs:

1. `git log --oneline` — recent commits since the last session ended
2. `git diff --stat HEAD~10..HEAD` — file change summary
3. Grep for `TODO`, `FIXME`, `HACK`, `XXX` in recently changed files

Results are stored as auto-expiring memories:

- `auto:git-changes:<session>` — 7-day TTL
- `auto:todos:<session>` — 14-day TTL

Set `autoExtractGit: false` to skip this.

### During a session

Agents should:

- Use `context` tool's `bootstrap` or `bootstrap_delta` to load/refresh context
- Use `context_for` before modifying files to get relevant constraints
- Store new knowledge with `functionality_set`
- Use `memory_watch` to detect concurrent changes to keys of interest

### Ending a session

End with a handoff summary:

```json
{
  "tool": "session",
  "action": "end",
  "sessionId": "session-2024-02-21-abc123",
  "summary": "Refactored auth middleware to use JWT. Added token refresh logic. Open question: should we support multiple active sessions per user?",
  "keysRead": ["agent/context/architecture/auth", "agent/context/constraints/security"],
  "keysWritten": ["agent/context/architecture/auth"],
  "toolsUsed": ["memory", "context", "branch"]
}
```

The summary is saved as the handoff for the next session. The `keysRead`, `keysWritten`, and `toolsUsed` arrays help track what was accessed.

### Session history

View previous sessions:

```json
{
  "tool": "session",
  "action": "history",
  "limit": 5
}
```

Returns session logs with summaries, branches, key access patterns, and timestamps. The `context` tool's `thread` action can analyze these logs to find hot keys.

## Session coordination

### Claims

When multiple agents might work concurrently, use claims to reserve keys:

```json
{
  "tool": "session",
  "action": "claim",
  "sessionId": "session-abc",
  "keys": ["agent/context/architecture/auth"],
  "ttlMinutes": 30
}
```

Before writing, check if anyone else has claimed the key:

```json
{
  "tool": "session",
  "action": "claims_check",
  "keys": ["agent/context/architecture/auth"],
  "excludeSession": "session-abc"
}
```

Claims expire after the TTL. They're advisory — they don't block writes, but they signal intent.

### Memory locking

For stricter coordination, use distributed locks via the `memory_lifecycle` tool:

```json
{
  "tool": "memory_lifecycle",
  "action": "lock",
  "key": "agent/context/architecture/auth",
  "lockedBy": "session-abc",
  "ttlSeconds": 60
}
```

Locks are hard blocks — other sessions cannot acquire a lock on the same key until it's released or expires.

## Branch plans

### Creating a branch plan

When starting work on a feature branch:

```json
{
  "tool": "branch",
  "action": "set",
  "content": "## Goal\nRefactor auth to use JWT tokens\n\n## Steps\n1. Add JWT signing utility\n2. Update login endpoint\n3. Add token refresh\n4. Update middleware\n5. Add tests",
  "status": "planning",
  "checklist": [
    { "item": "Add JWT signing utility", "done": false },
    { "item": "Update login endpoint", "done": false },
    { "item": "Add token refresh", "done": false },
    { "item": "Update middleware", "done": false },
    { "item": "Add tests", "done": false }
  ]
}
```

The branch name is auto-detected from git. The plan is stored as `branch_plan:<branch_name>`.

### Plan statuses

| Status | Meaning |
|--------|---------|
| `planning` | Design phase, plan not finalized |
| `in_progress` | Active implementation |
| `review` | Code review / PR stage |
| `merged` | Branch merged, plan complete |

### Updating progress

Update the plan and checklist as work progresses:

```json
{
  "tool": "branch",
  "action": "set",
  "content": "...(updated content)...",
  "status": "in_progress",
  "checklist": [
    { "item": "Add JWT signing utility", "done": true },
    { "item": "Update login endpoint", "done": true },
    { "item": "Add token refresh", "done": false },
    { "item": "Update middleware", "done": false },
    { "item": "Add tests", "done": false }
  ]
}
```

### Getting related context

When fetching a branch plan, set `includeRelatedContext: true` to find context entries related to the branch's topic:

```json
{
  "tool": "branch",
  "action": "get",
  "includeRelatedContext": true
}
```

This splits the branch name into terms (e.g. `feature/auth-refactor` -> `auth`, `refactor`) and scores all context entries by term matches.

## Branch memory management

### Tagging memories with branches

When storing memories during branch work, use `autoBranch: true`:

```json
{
  "tool": "memory",
  "action": "store",
  "key": "agent/context/lessons_learned/jwt_pitfall",
  "content": "JWT tokens must include the iat claim...",
  "autoBranch": true
}
```

This adds a `branch:<branch_name>` tag to the memory.

### Viewing branch-specific memories

```json
{
  "tool": "memory_advanced",
  "action": "branch_filter",
  "branch": "feature/auth-refactor"
}
```

Without a branch param, returns a count of memories per branch.

### After merging

When a branch is merged, either promote its memories globally or archive them:

```json
{
  "tool": "memory_advanced",
  "action": "branch_merge",
  "branch": "feature/auth-refactor",
  "mergeAction": "promote",
  "dryRun": true
}
```

- **promote** — removes the branch tag, keeping the memory globally visible
- **archive** — archives the branch-specific memories

Use `dryRun: true` to preview before applying.

The `lifecycle_run` action with `archive_merged_branches` policy can do this automatically.

## Memos

Leave messages for the next agent session:

```json
{
  "tool": "activity",
  "action": "memo_leave",
  "message": "The auth migration is half-done. Don't modify the session table until the JWT branch is merged.",
  "urgency": "blocker",
  "relatedKeys": ["agent/context/architecture/auth"]
}
```

Urgency levels:

| Urgency | Priority | TTL | Description |
|---------|----------|-----|-------------|
| `info` | 30 | 3 days | Nice to know |
| `warning` | 60 | 3 days | Should be aware |
| `blocker` | 90 | 7 days | Must address before proceeding |

Read memos at the start of a session:

```json
{
  "tool": "activity",
  "action": "memo_read"
}
```

Memos are sorted by urgency (blockers first) and auto-expire based on their TTL.

## Typical workflow

1. **Session start**: `session.start` -> get handoff + git context
2. **Load context**: `context.bootstrap` -> get all project knowledge
3. **Read memos**: `activity.memo_read` -> check for messages from previous sessions
4. **Check branch plan**: `branch.get` -> see what's planned for this branch
5. **Do work**: Use `context.context_for` before modifying files, store learnings with `context.functionality_set`
6. **Update plan**: `branch.set` with updated checklist
7. **Leave memos**: `activity.memo_leave` if there's anything the next session needs to know
8. **Session end**: `session.end` with summary of what was done
