# CLI Reference

memctl provides 14 CLI commands for managing memories, running the MCP server, and configuring your environment. The default command (no arguments) starts the MCP server.

## Commands

### serve (default)

Start the MCP server over stdio. This is what IDEs call when connecting.

```bash
memctl serve
memctl          # same thing
```

The server reads configuration from env vars or `~/.memctl/config.json` (see [Configuration](./configuration.md)) and connects via stdin/stdout using the MCP protocol.

---

### init

Interactive setup wizard or targeted IDE config writer.

```bash
memctl init               # Full interactive wizard
memctl init --claude      # Write Claude Code MCP config only
memctl init --cursor      # Write Cursor MCP config only
memctl init --windsurf    # Write Windsurf MCP config only
memctl init --all         # Write all IDE configs
```

The full wizard:

1. Asks for your API token
2. Auto-detects org/project from git remote (or asks)
3. Tests API connectivity
4. Saves credentials to `~/.memctl/config.json`
5. Optionally writes IDE MCP config

The `--claude`, `--cursor`, `--windsurf`, and `--all` flags skip the wizard and only write IDE config files using credentials from your existing config file.

---

### doctor

Run diagnostics to verify your setup.

```bash
memctl doctor
```

Checks performed:

- Config file exists at `~/.memctl/config.json`
- Credentials are resolvable (env vars or config)
- API is reachable
- Auth token is valid
- Org/project access works
- Memory capacity status
- Local cache health
- Pending writes queue

Output is color-coded: green checkmark = pass, yellow ! = warning, red X = fail.

---

### list

List memories in the current project.

```bash
memctl list
memctl list --limit 20
memctl list --sort priority
memctl list --tags "coding_style,testing"
memctl list --include-archived
memctl list --json
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit` | number | 50 | Maximum results |
| `--sort` | string | — | Sort by: `updated`, `priority`, `created` |
| `--tags` | string | — | Comma-separated tag filter |
| `--include-archived` | boolean | false | Include archived memories |
| `--json` | boolean | false | Output raw JSON |

Default output shows key, priority, and tags for each memory. Use `--json` for full details.

---

### get

Get a single memory by key.

```bash
memctl get agent/context/coding_style/general
```

Always outputs full JSON.

---

### search

Full-text search across memories.

```bash
memctl search "typescript conventions"
memctl search authentication --limit 5
memctl search "error handling" --json
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit` | number | 50 | Maximum results |
| `--json` | boolean | false | Output raw JSON |

Default output shows key and a truncated content preview. Uses the hybrid search pipeline (FTS5 + vector similarity + RRF scoring).

---

### export

Export memories in various formats.

```bash
memctl export                    # agents_md (default)
memctl export agents_md
memctl export cursorrules
memctl export json
memctl export --format json
```

| Format | Description |
|--------|-------------|
| `agents_md` | Markdown grouped by context type with table of contents |
| `cursorrules` | Flat markdown format compatible with Cursor rules |
| `json` | Structured JSON grouped by type |

Output goes to stdout. Pipe to a file:

```bash
memctl export agents_md > AGENTS.md
memctl export cursorrules > .cursorrules
```

---

### import

Import memories from a file. Parses markdown headings into separate memory entries.

```bash
memctl import AGENTS.md
memctl import .cursorrules
memctl import copilot-instructions.md
```

Each heading (h1/h2/h3) becomes a separate memory under the `agent/context/imported/` namespace. The heading text is slugified to create the key.

Example: a file with `## Error Handling` becomes key `agent/context/imported/error_handling`.

---

### snapshot

Create a named snapshot of all current memories.

```bash
memctl snapshot "before-refactor"
memctl snapshot "v2-release" --description "Context state at v2 launch"
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--description` | string | — | Optional snapshot description |

Snapshots are immutable copies of all project memories at a point in time.

---

### snapshots

List existing snapshots.

```bash
memctl snapshots
memctl snapshots --limit 5
memctl snapshots --json
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit` | number | 50 | Maximum results |
| `--json` | boolean | false | Output raw JSON |

---

### capacity

Show memory capacity usage for the current project and organization.

```bash
memctl capacity
```

Example output:

```
Project: 42/200 memories
Org:     156/500 memories
Usage:   21.0%
Status:  OK
```

Status values: `OK`, `Approaching limit`, `FULL`.

---

### cleanup

Suggest stale and expired memories for cleanup.

```bash
memctl cleanup
memctl cleanup --stale-days 60
memctl cleanup --limit 10
memctl cleanup --json
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--stale-days` | number | 30 | Days without access to consider stale |
| `--limit` | number | 50 | Maximum suggestions |
| `--json` | boolean | false | Output raw JSON |

This only suggests — it doesn't delete anything. Use the `memory_lifecycle` MCP tool or the API to act on suggestions.

---

### lifecycle

Run lifecycle policies to manage memory health.

```bash
memctl lifecycle cleanup_expired
memctl lifecycle archive_merged_branches cleanup_session_logs
memctl lifecycle auto_promote auto_demote
```

Available policies:

| Policy | Description |
|--------|-------------|
| `archive_merged_branches` | Archive memories tagged with merged branches |
| `cleanup_expired` | Delete memories past their `expiresAt` |
| `cleanup_session_logs` | Remove old session logs |
| `auto_promote` | Increase priority of frequently accessed memories |
| `auto_demote` | Decrease priority of unused memories |

Multiple policies can be passed as separate arguments. Output is always JSON showing affected counts per policy.

---

### help

Show usage information.

```bash
memctl help
memctl --help
memctl -h
```

## Environment variables

All CLI commands (except `init`, `doctor`, and `help`) require these:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEMCTL_TOKEN` | Yes | — | API bearer token |
| `MEMCTL_ORG` | Yes | — | Organization slug |
| `MEMCTL_PROJECT` | Yes | — | Project slug |
| `MEMCTL_API_URL` | No | `https://memctl.com/api/v1` | API base URL |

These can also be set via `~/.memctl/config.json`. See [Configuration](./configuration.md).
