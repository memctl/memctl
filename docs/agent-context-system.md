# Agent Context System

memctl organizes agent knowledge into typed context entries. Each entry has a type, an ID, and content. The context system provides bootstrapping, file-aware retrieval, token budgeting, and import/export.

## Built-in context types

There are 9 built-in types that cover common agent knowledge:

| Type               | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `coding_style`     | Language conventions, naming, formatting, anti-patterns   |
| `folder_structure` | Repository organization and directory layout              |
| `file_map`         | Index of key files, entry points, config files            |
| `architecture`     | System design, module boundaries, data flow, decisions    |
| `workflow`         | Branching strategy, PR process, deployment, code review   |
| `testing`          | Test framework, coverage requirements, conventions        |
| `branch_plan`      | Implementation plan for the current feature branch        |
| `constraints`      | Hard requirements, security rules, performance limits     |
| `lessons_learned`  | Pitfalls, gotchas, things that failed, negative knowledge |

You can also create custom types with the `context_config` tool's `type_create` action.

## Key format

Context entries are stored as regular memories with a specific key format:

```
agent/context/{type}/{id}
```

For example:

- `agent/context/coding_style/typescript`
- `agent/context/architecture/database_layer`
- `agent/context/constraints/security`
- `agent/context/lessons_learned/migration_failure`

Branch plans use a different format:

```
branch_plan:{branch_name}
```

## Creating context entries

Use the `context` tool with `functionality_set`:

```json
{
  "action": "functionality_set",
  "type": "coding_style",
  "id": "typescript",
  "content": "- Use strict mode\n- Prefer interfaces over type aliases\n- Use early returns\n- No default exports",
  "priority": 80,
  "tags": ["typescript"]
}
```

This creates a memory with key `agent/context/coding_style/typescript`.

## Templates

Each built-in type has a markdown template. Get it with `context_config` tool's `template_get`:

```json
{
  "action": "template_get",
  "type": "coding_style"
}
```

Returns a template like:

```markdown
## Language & Conventions

- Primary language:
- Style guide:

## Naming

- Variables:
- Functions:
- Files:

## Formatting

- Indentation:
- Line length:
- Import ordering:

## Patterns

- Preferred patterns:
- Anti-patterns to avoid:
```

Custom types get a generic template.

## Bootstrapping

When an agent session starts, it calls `bootstrap` to load all context:

```json
{
  "tool": "context",
  "action": "bootstrap"
}
```

This returns:

- All context entries grouped by type
- Branch plan (if on a feature branch)
- Memory capacity info
- Org defaults hint (if context is empty but org has defaults)

For subsequent calls, use `bootstrap_delta` with a timestamp to get only changes since the last bootstrap, avoiding re-loading everything.

For a lightweight check, use `bootstrap_compact` which returns counts and sizes without full content.

### Bootstrap filtering

You can filter bootstrap by type or branch:

```json
{
  "action": "bootstrap",
  "types": ["coding_style", "constraints"],
  "branch": "feature/auth"
}
```

When a branch filter is active, branch-specific entries are sorted to the top.

## File-aware retrieval

Before modifying files, agents call `context_for` to get relevant context:

```json
{
  "action": "context_for",
  "filePaths": ["src/auth/login.ts", "src/auth/session.ts"]
}
```

This scores all context entries by:

- Filename matches (does the memory mention `login.ts` or `session.ts`?)
- Path component overlap (does the memory reference `src/auth/` paths?)

Returns the most relevant entries for the files being modified.

## Token budgeting

The `budget` action selects optimal context within a token limit:

```json
{
  "action": "budget",
  "maxTokens": 8000,
  "types": ["coding_style", "constraints", "architecture"]
}
```

Efficiency scoring formula:

```
efficiency = (priority*2 + accessCount*2 + helpful*3 + recency + isPinned*30) / estimatedTokens
```

This ensures the most valuable context fits within the agent's available context window.

## Task-based composition

The `compose` action builds context for a specific task:

```json
{
  "action": "compose",
  "task": "Refactor the authentication system to use JWT",
  "maxTokens": 8000
}
```

This:

1. Matches task keywords against memory content
2. Boosts scores for `constraints` and `lessons_learned` types
3. Follows links to include related context
4. Fits everything within the token budget

## Smart retrieval

The `smart_retrieve` action combines intent-based search with file matching:

```json
{
  "action": "smart_retrieve",
  "intent": "How do we handle database migrations?",
  "files": ["packages/db/src/schema.ts"],
  "maxResults": 5
}
```

## Conditional rules

Context entries can include conditional rules that match against file patterns, branch patterns, or task types. The `rules_evaluate` action finds matching rules:

```json
{
  "action": "rules_evaluate",
  "filePaths": ["src/api/**/*.ts"],
  "branch": "feature/*",
  "taskType": "refactor"
}
```

Rules are evaluated using glob matching against the provided patterns.

## Import and export

### Importing from existing files

Import from AGENTS.md, .cursorrules, or copilot-instructions.md:

```json
{
  "tool": "import_export",
  "action": "agents_md_import",
  "content": "# Coding Style\n- Use TypeScript...\n\n# Architecture\n- Monorepo with...",
  "dryRun": true
}
```

The parser maps 50+ heading patterns to context types. Set `dryRun: true` to preview without importing.

### Exporting

Export all context as AGENTS.md:

```json
{
  "tool": "import_export",
  "action": "export_agents_md",
  "format": "agents_md"
}
```

Available formats: `agents_md`, `cursorrules`, `json`.

You can also export via the CLI:

```bash
memctl export agents_md > AGENTS.md
memctl export cursorrules > .cursorrules
```

## Custom types

Create types beyond the built-in 9:

```json
{
  "tool": "context_config",
  "action": "type_create",
  "slug": "api_conventions",
  "label": "API Conventions",
  "description": "REST API design patterns and response formats"
}
```

Custom types work exactly like built-in types. They can have entries, be included in bootstrap, and participate in all context operations. The only restriction is you cannot override or delete built-in types.

## Quality and health

Use the `memory_advanced` tool's `quality` action to score context entries:

```json
{
  "tool": "memory_advanced",
  "action": "quality"
}
```

And `contradictions` to find conflicting directives:

```json
{
  "tool": "memory_advanced",
  "action": "contradictions"
}
```

This detects patterns like "use X" in one entry and "avoid X" in another.

## Org defaults

Organizations can define default context entries that get applied to new projects:

```json
{
  "tool": "org",
  "action": "defaults_set",
  "key": "agent/context/coding_style/org-standard",
  "content": "All projects use TypeScript strict mode..."
}
```

Then apply to a project:

```json
{
  "tool": "org",
  "action": "defaults_apply"
}
```

See [Organization & Teams](./organization-and-teams.md) for more on org-level features.
