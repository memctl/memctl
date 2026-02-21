# Getting Started

Get memctl running as an MCP server in your IDE in about 5 minutes.

## Prerequisites

- Node.js 20+
- An IDE that supports MCP: Claude Code, Cursor, or Windsurf
- A memctl account (sign up at [memctl.com](https://memctl.com))

## 1. Get your API token

Sign in at [memctl.com](https://memctl.com), create an organization and project, then generate an API token from the dashboard under **Settings > API Tokens**.

You need three values:

- **API token** — the bearer token for authentication
- **Organization slug** — your org's URL slug (e.g. `my-team`)
- **Project slug** — the project's URL slug (e.g. `backend-api`)

## 2. Run the setup wizard

The fastest way to configure everything:

```bash
npx memctl init
```

The wizard will:

1. Ask for your API token
2. Ask for (or auto-detect from git remote) your org and project slugs
3. Test connectivity to the API
4. Save credentials to `~/.memctl/config.json`
5. Optionally write your IDE's MCP config file

If you already know which IDE you want, skip the interactive wizard:

```bash
npx memctl init --claude     # Claude Code only
npx memctl init --cursor     # Cursor only
npx memctl init --windsurf   # Windsurf only
npx memctl init --all        # All IDEs
```

## 3. Verify the setup

```bash
npx memctl doctor
```

Doctor checks:

- Config file exists
- Credentials are present (env vars or config file)
- API is reachable
- Token is valid
- Org/project access works
- Memory capacity is within limits
- Local cache is healthy
- No pending offline writes

You should see all green checkmarks. If anything fails, see [Troubleshooting](./troubleshooting.md).

## 4. Store your first memory

```bash
export MEMCTL_TOKEN=your-token
export MEMCTL_ORG=your-org
export MEMCTL_PROJECT=your-project

npx memctl search "test"
```

Or through the MCP server in your IDE, use the `memory` tool:

```
Action: store
Key: agent/context/coding_style/general
Content: |
  - Use TypeScript strict mode
  - Prefer named exports
  - Use early returns over nested conditionals
```

## 5. Use it in your IDE

Once configured, your AI coding agent has access to 11 MCP tools. The typical startup flow is:

1. Agent calls `context` tool with `bootstrap` action to load all project context
2. Agent calls `session` tool with `start` action to register the session
3. During work, agent uses `context` tool with `context_for` to get relevant context for files being modified
4. On session end, agent calls `session` tool with `end` action to save a handoff summary

See [MCP Tools Reference](./mcp-tools-reference.md) for the full list of tools and actions.

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI coding agents to external tools and data sources. memctl runs as an MCP server that your IDE connects to over stdio. The server exposes tools (functions the agent can call), resources (data the agent can read), and prompts (templates for common workflows).

When your IDE starts, it launches `npx memctl` as a subprocess. The agent communicates with it over stdin/stdout using the MCP protocol. The memctl server then forwards requests to the memctl API.

## Alternative: environment variables

If you prefer not to use the config file, set these environment variables:

```bash
export MEMCTL_TOKEN=your-token
export MEMCTL_ORG=your-org
export MEMCTL_PROJECT=your-project
# Optional:
export MEMCTL_API_URL=https://memctl.com/api/v1
```

See [Configuration](./configuration.md) for the full resolution order.

## Next steps

- [IDE Setup](./ide-setup.md) — detailed per-IDE configuration
- [CLI Reference](./cli-reference.md) — use the CLI for quick lookups and management
- [Agent Context System](./agent-context-system.md) — understand how context types work
- [Local Development](./local-development.md) — run the full stack locally with Docker
