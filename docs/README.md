# memctl docs

Documentation for memctl — persistent memory for AI coding agents.

## Getting Started

- [Getting Started](./getting-started.md) — zero to working MCP server in 5 minutes
- [IDE Setup](./ide-setup.md) — Claude Code, Cursor, Windsurf configuration
- [Configuration](./configuration.md) — env vars, config files, profiles, resolution order

## Reference

- [CLI Reference](./cli-reference.md) — all 14 CLI commands with flags and examples
- [MCP Tools Reference](./mcp-tools-reference.md) — all 11 tools, 90+ actions, params, examples
- [MCP Resources & Prompts](./mcp-resources-and-prompts.md) — 7 resources and 3 prompt templates
- [REST API Reference](./api-reference.md) — all endpoints, auth, headers, pagination

## Concepts

- [Agent Context System](./agent-context-system.md) — context types, bootstrapping, imports/exports
- [Session & Branch Workflow](./session-and-branch-workflow.md) — session lifecycle, branch plans, handoff
- [Offline & Caching](./offline-and-caching.md) — cache layers, ETags, offline fallback, pending writes
- [Organization & Teams](./organization-and-teams.md) — orgs, projects, defaults, templates

## Deployment

- [Self-Hosting](./self-hosting.md) — run memctl on your own infrastructure with unlimited everything

## Development

- [Local Development](./local-development.md) — Docker setup, testing CLI/MCP locally, running tests
- [Architecture](./architecture.md) — monorepo structure, search pipeline, middleware, schema
- [Contributing](./contributing.md) — adding tools, commands, endpoints, testing
- [Troubleshooting](./troubleshooting.md) — common errors and fixes

## Other

- [Environment Variable Examples](./env-examples.md) — copy-paste env configs for common scenarios
- [Billing Plan Example](./billing-plan-example.md) — Stripe integration reference model
- [Testing Environment Setup](./testing-environment.md) — legacy setup guide (see [Local Development](./local-development.md))

## Quick Start

```bash
npm install -g memctl
memctl init
memctl doctor
```

Or use npx without installing:

```bash
npx memctl init
npx memctl doctor
```

See [Getting Started](./getting-started.md) for the full walkthrough.
