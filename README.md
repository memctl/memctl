# mem/ctl

Shared, persistent memory for AI coding agents. One project brain across machines and IDEs.

## What is mem/ctl?

mem/ctl is a cloud MCP server that gives AI coding agents (Claude Code, Cursor, Windsurf, etc.) shared, persistent memory scoped to projects and organizations. Teams share one project brain across machines and IDEs.

## Quick Start

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["@memctl/cli"],
      "env": {
        "MEMCTL_TOKEN": "<your-token>",
        "MEMCTL_ORG": "<org-slug>",
        "MEMCTL_PROJECT": "<project-slug>"
      }
    }
  }
}
```

## MCP Tools

| Tool | Description |
|---|---|
| `memory_store` | Store a key-value memory |
| `memory_get` | Retrieve a memory by key |
| `memory_search` | Search memories by query |
| `memory_list` | List all memories |
| `memory_delete` | Delete a memory |
| `memory_update` | Update a memory |

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Monorepo:** pnpm workspaces + Turborepo
- **Web:** Next.js 15 (App Router)
- **Database:** Turso (libSQL) + Drizzle ORM
- **Auth:** better-auth (GitHub OAuth)
- **Payments:** Stripe
- **MCP:** @modelcontextprotocol/sdk

## Development

```bash
pnpm install
pnpm dev
```

## Project Structure

```
memctl/
├── apps/web/          # Next.js app (dashboard + landing + docs)
├── packages/
│   ├── mcp-server/    # @memctl/cli npm package
│   ├── db/            # Shared Drizzle schema + client
│   └── shared/        # Shared types, constants, validators
├── plans/             # Implementation task tracker
└── turbo.json
```

## License

Apache-2.0
