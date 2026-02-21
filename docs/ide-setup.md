# IDE Setup

How to configure memctl as an MCP server in each supported IDE.

## Quick setup

If you've already run `memctl init` and saved your credentials, just run:

```bash
npx memctl init --claude     # Claude Code
npx memctl init --cursor     # Cursor
npx memctl init --windsurf   # Windsurf
npx memctl init --all        # All IDEs at once
```

This writes the correct config file with your credentials. You're done.

If you want to set things up manually, or understand what the config file looks like, read on.

## Claude Code

Config file location: `.claude/mcp.json` in your project root.

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "your-token",
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

After saving, restart Claude Code or reload the MCP servers. You should see `memctl` listed as a connected server with 11 tools available.

### Using a global install

If you installed memctl globally (`npm install -g memctl`), you can use the binary directly:

```json
{
  "mcpServers": {
    "memctl": {
      "command": "memctl",
      "args": [],
      "env": {
        "MEMCTL_TOKEN": "your-token",
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

## Cursor

Config file location: `.cursor/mcp.json` in your project root.

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "your-token",
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

After saving, restart Cursor. The MCP server should connect automatically.

## Windsurf

Config file location: `~/.codeium/windsurf/mcp_config.json` (global, not per-project).

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "your-token",
        "MEMCTL_API_URL": "https://memctl.com/api/v1",
        "MEMCTL_ORG": "your-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

Note: Windsurf uses a global config, not a project-local one. If you work on multiple projects, you'll need to update the org/project values when switching.

After saving, restart Windsurf.

## Verifying the connection

Once your IDE is configured, you can verify the MCP server is working by asking your agent to run a simple tool call:

```
Use the memory tool with action "capacity" to check my memory usage.
```

The agent should return your current memory count and limits. If it fails, check [Troubleshooting](./troubleshooting.md).

## Config file merging

The `memctl init` commands merge with existing MCP config. If you already have other MCP servers configured, they won't be overwritten. Only the `memctl` key is added or updated.

## npx vs global install

**npx** (recommended): Always uses the latest version. No install step. Slightly slower on first run since it downloads the package.

```bash
npx -y memctl@latest
```

**Global install**: Faster startup. You control the version. Update manually.

```bash
npm install -g memctl
```

Both approaches work identically. The only difference is startup time and version management.

## Local development

If you're running the memctl server locally with Docker, point `MEMCTL_API_URL` to your local instance:

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "your-local-token",
        "MEMCTL_API_URL": "http://localhost:3000/api/v1",
        "MEMCTL_ORG": "dev-org",
        "MEMCTL_PROJECT": "your-project"
      }
    }
  }
}
```

See [Local Development](./local-development.md) for the full local setup.
