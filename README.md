<p align="center">
  <a href="https://memctl.com">
    <img src="apps/web/app/icon1.png" width="80" height="80" alt="memctl logo" />
  </a>
</p>

<h3 align="center">mem/ctl</h3>

<p align="center">
  Shared, persistent memory for AI coding agents.
  <br />
  One project brain across machines and IDEs.
  <br />
  <br />
  <a href="https://memctl.com"><strong>Website</strong></a> &#183;
  <a href="https://memctl.com/docs"><strong>Docs</strong></a> &#183;
  <a href="https://memctl.com/changelog"><strong>Changelog</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/memctl"><img src="https://img.shields.io/npm/v/memctl?style=flat&color=F97316&label=npm" alt="npm version" /></a>
  <a href="https://github.com/memctl/memctl/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat" alt="License" /></a>
  <a href="https://github.com/memctl/memctl/actions"><img src="https://img.shields.io/github/actions/workflow/status/memctl/memctl/ci.yml?branch=main&style=flat&label=CI" alt="CI" /></a>
</p>

---

## What is mem/ctl?

mem/ctl is a cloud MCP server that gives AI coding agents shared, persistent memory scoped to projects and organizations. Claude Code, Cursor, Windsurf, Cline, Roo Code, Codex, OpenCode, and any MCP-compatible agent can read and write to the same project context.

Your team shares one brain. Every agent knows the architecture, conventions, decisions, and constraints without repeating yourself.

## Quick start

```bash
npx memctl auth
npx memctl init
```

The init wizard detects your IDE and writes the MCP config automatically. Or configure manually:

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "<your-token>",
        "MEMCTL_ORG": "<org-slug>",
        "MEMCTL_PROJECT": "<project-slug>"
      }
    }
  }
}
```

## Agent support

| Agent | Config file | Init shortcut | Generate |
| --- | --- | --- | --- |
| Claude Code | `.mcp.json` | `memctl init --claude` | `memctl generate --claude` |
| Cursor | `.cursor/mcp.json` | `memctl init --cursor` | `memctl generate --cursor` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `memctl init --windsurf` | `memctl generate --windsurf` |
| Cline | `.vscode/mcp.json` | `memctl init --cline` | `memctl generate --cline` |
| Roo Code | `.vscode/mcp.json` | `memctl init --roo` | `memctl generate --roo` |
| Codex | `codex.json` | `memctl init --codex` | `memctl generate --codex` |
| OpenCode | `opencode.json` | `memctl init --opencode` | `memctl generate --opencode` |

All agents, all at once:

```bash
npx memctl init --all
```

## MCP tools

mem/ctl exposes 11 tools to connected agents:

| Tool | What it does |
| --- | --- |
| `memory` | Store, get, search, list, update, delete memories with dedup and tagging |
| `memory_advanced` | Batch get, find similar, diff, merge, and rename keys |
| `memory_lifecycle` | Archive, restore, history, bulk tag/untag, and capacity checks |
| `context` | Bootstrap project context, delta sync, smart retrieval, rules evaluation |
| `context_config` | Manage typed project guidance (coding style, architecture, constraints) |
| `session` | Session lifecycle, conflict claims, and rate status |
| `activity` | Memos, activity log, impact analysis |
| `branch` | Branch-scoped context and implementation plans |
| `repo` | Repository structure analysis |
| `org` | Organization info and project listing |
| `import_export` | Bulk import/export memories as JSON |

Plus 7 resources and 3 prompts for richer agent integration.

## How it works

```
Agent (Claude, Cursor, ...) <--MCP--> memctl CLI <--HTTPS--> memctl Cloud
                                                                  |
                                                          Turso (libSQL)
                                                         FTS5 + Vectors
```

1. Agent connects to `memctl` via MCP (stdio transport)
2. On startup, the agent bootstraps project context (conventions, architecture, constraints)
3. During the session, the agent reads and writes memories as needed
4. All agents on the team share the same project memory
5. Session tracking prevents write conflicts across concurrent agents

## Features

- **Project-scoped memory** with key-value storage and rich metadata
- **Hybrid search** combining FTS5 full-text and vector embeddings (all-MiniLM-L6-v2)
- **Smart deduplication** that warns, skips, or merges similar content
- **Branch context** for tracking implementation plans per git branch
- **Session management** with conflict detection and automatic handoff
- **Activity memos** for cross-session communication between agents
- **Content quality filter** that blocks noise (shell dumps, raw diffs, JSON blobs)
- **Typed project guidance** for architecture, coding style, folder maps, and constraints
- **Organization defaults** that apply across all projects
- **Role-based access** with owner, admin, and member roles
- **Self-hostable** with Docker

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js + TypeScript |
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js 15 (App Router) |
| Database | Turso (libSQL) + Drizzle ORM |
| Search | FTS5 + vector embeddings |
| Auth | better-auth (GitHub OAuth + magic link) |
| Payments | Stripe |
| MCP | @modelcontextprotocol/sdk |
| Testing | Vitest |

## Project structure

```
apps/web/          Next.js dashboard + REST API
packages/cli/      MCP server + CLI (published to npm as "memctl")
packages/db/       Drizzle ORM schema + migrations
packages/shared/   Types, validators, constants
```

## Development

```bash
git clone https://github.com/memctl/memctl.git
cd memctl
pnpm install
pnpm dev
```

See [DOCKER.md](DOCKER.md) for Docker-based development and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Useful commands

```bash
pnpm dev                     # Dev server (Turbopack)
pnpm lint                    # ESLint all packages
pnpm format:check            # Prettier check
npx vitest run               # Run tests
pnpm db:push                 # Push schema to DB
pnpm db:generate             # Generate migrations
pnpm db:migrate              # Run migrations
```

## Self-hosting

Set `SELF_HOSTED=true` and `NEXT_PUBLIC_SELF_HOSTED=true` to run your own instance. This disables billing and unlocks all plan limits.

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com -t memctl-web .
```

See [DOCKER.md](DOCKER.md) for the full self-hosting guide.

## Documentation

- [Docs](https://memctl.com/docs) -- full documentation
- [Architecture](docs/architecture.md) -- system design and infrastructure
- [Docker](DOCKER.md) -- Docker setup for dev and production
- [Contributing](CONTRIBUTING.md) -- how to contribute
- [Security](SECURITY.md) -- security policy

## License

[Apache-2.0](LICENSE)
