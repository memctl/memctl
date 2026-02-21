# MCP Resources & Prompts

memctl exposes 7 MCP resources and 3 prompt templates. Resources provide read-only data the agent can access. Prompts are templates that generate structured messages for common workflows.

## Resources

### project-memories

**URI:** `memory://project/{slug}`

Returns all memories for the project as JSON. Paginated at 100 items.

```json
{
  "memories": [
    { "key": "...", "content": "...", "priority": 50, "tags": [...] }
  ]
}
```

### single-memory

**URI:** `memory://project/{slug}/{key}`

Returns a single memory by key with full content, metadata, tags, and access statistics.

### memory-capacity

**URI:** `memory://capacity`

Returns current memory usage metrics.

```json
{
  "used": 42,
  "limit": 200,
  "orgUsed": 156,
  "orgLimit": 500,
  "isFull": false,
  "isApproaching": false,
  "usageRatio": 0.21
}
```

### agent-functionalities

**URI:** `agent://functionalities`

Returns all context types with their items. This is the full inventory of agent context entries grouped by type (coding_style, architecture, testing, etc.) with complete content.

Also includes branch info and memory status metadata.

### agent-functionality-type

**URI:** `agent://functionalities/{type}`

Returns items for a specific context type only. Type must be a valid built-in or custom context type.

### agent-branch-current

**URI:** `agent://branch/current`

Returns the current git branch name and any associated branch plan stored in memory.

```json
{
  "branch": "feature/auth-refactor",
  "plan": { "content": "...", "status": "in_progress", "checklist": [...] }
}
```

### connection-status

**URI:** `memctl://connection-status`

Returns whether the MCP client is currently online or in offline mode.

```json
{
  "online": true
}
```

### agent-bootstrap

**URI:** `agent://bootstrap`

Comprehensive startup resource that combines all functionalities, branch info, branch plan, and capacity in a single read. Useful for agents that want to load everything at once without multiple resource reads.

## Prompts

### agent-startup

**Name:** `agent-startup`

**Parameters:** none

Generates a startup message that instructs the agent on how to use memctl. Covers:

- Calling `agent_bootstrap` to load project context
- Calling `session_start` to register the session and get the previous handoff
- Using `memory_watch` to detect concurrent changes
- Using `agent_context_for` before modifying files
- Using `memory_check_duplicates` before creating new memories
- Using `context_budget` for token-aware context retrieval
- Ending sessions with `session_end` for continuity
- Storing negative knowledge as `lessons_learned`

### context-for-files

**Name:** `context-for-files`

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `files` | string | Comma-separated file paths you plan to modify |

Generates a message that instructs the agent to call `agent_context_for` with the given file paths and follow any constraints or patterns found.

Example usage:

```
Prompt: context-for-files
files: "src/auth/login.ts,src/auth/session.ts"
```

### session-handoff

**Name:** `session-handoff`

**Parameters:** none

Generates a message that instructs the agent to create a session handoff summary including:

- What was accomplished
- Key decisions made
- Open questions
- Modified files
- Memory keys written

Then instructs the agent to call `session_end` with the summary.
