# Configuration

memctl configuration can come from environment variables, a config file, or IDE config files. This page covers all of them and how they interact.

## Resolution priority

When memctl starts, it resolves configuration in this order (first match wins):

1. **Environment variables** — `MEMCTL_TOKEN`, `MEMCTL_ORG`, `MEMCTL_PROJECT`, `MEMCTL_API_URL`
2. **Config file** — `~/.memctl/config.json`, matched by current working directory
3. **IDE config** — `.claude/mcp.json`, `.cursor/mcp.json`, or `~/.codeium/windsurf/mcp_config.json`

If all three env vars (`MEMCTL_TOKEN`, `MEMCTL_ORG`, `MEMCTL_PROJECT`) are set, the config file is not read at all. The API URL defaults to `https://memctl.com/api/v1` if not set.

## Environment variables

### CLI / MCP server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEMCTL_TOKEN` | Yes | — | API bearer token |
| `MEMCTL_ORG` | Yes | — | Organization slug |
| `MEMCTL_PROJECT` | Yes | — | Project slug |
| `MEMCTL_API_URL` | No | `https://memctl.com/api/v1` | API base URL |

### Web server (self-hosted)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TURSO_DATABASE_URL` | Yes | — | libSQL/Turso database URL |
| `TURSO_AUTH_TOKEN` | Yes* | — | Turso auth token (* empty for local libSQL) |
| `BETTER_AUTH_SECRET` | Yes | — | Secret for session signing |
| `BETTER_AUTH_URL` | Yes | — | App URL for auth callbacks |
| `GITHUB_CLIENT_ID` | Yes* | — | GitHub OAuth client ID (* or use dev bypass) |
| `GITHUB_CLIENT_SECRET` | Yes* | — | GitHub OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | Yes | — | Public-facing app URL |
| `STRIPE_SECRET_KEY` | No | — | Stripe secret key for billing |
| `STRIPE_PUBLISHABLE_KEY` | No | — | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook signing secret |
| `RESEND_API_KEY` | No | — | Resend API key for emails (logs to console without it) |
| `GITHUB_TOKEN` | No | — | GitHub API token for landing page stats |
| `LOG_LEVEL` | No | `info` | Pino log level |

### Dev auth bypass

For local development without GitHub OAuth:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_AUTH_BYPASS` | `false` | Enable dev auth bypass |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS` | `false` | Enable bypass on client side |
| `DEV_AUTH_BYPASS_ORG_SLUG` | `dev-org` | Auto-created org slug |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS_ORG_SLUG` | `dev-org` | Client-side org slug |
| `DEV_AUTH_BYPASS_USER_EMAIL` | `dev@local.memctl.test` | Dev user email |
| `DEV_AUTH_BYPASS_USER_NAME` | `Dev User` | Dev user display name |
| `DEV_AUTH_BYPASS_ADMIN` | `false` | Give dev user admin access |

## Config file

Location: `~/.memctl/config.json`

Created by `memctl init`. Structure:

```json
{
  "profiles": {
    "default": {
      "token": "your-api-token",
      "apiUrl": "https://memctl.com/api/v1"
    },
    "work": {
      "token": "work-token",
      "apiUrl": "https://memctl.com/api/v1"
    }
  },
  "projects": {
    "/home/user/projects/my-app": {
      "org": "my-team",
      "project": "my-app",
      "profile": "default"
    },
    "/home/user/work/internal-tool": {
      "org": "work-org",
      "project": "internal-tool",
      "profile": "work"
    }
  }
}
```

### Profiles

Profiles store authentication credentials. Each profile has a `token` and `apiUrl`. You can have multiple profiles for different accounts or environments.

### Projects

Projects map absolute directory paths to org/project/profile combinations. When memctl starts, it resolves the current working directory and looks for a matching project entry. This is how you can work on multiple projects with different credentials without changing environment variables.

## IDE config files

These are the MCP server config files that tell your IDE how to start memctl:

| IDE | Location | Scope |
|-----|----------|-------|
| Claude Code | `.claude/mcp.json` | Per-project |
| Cursor | `.cursor/mcp.json` | Per-project |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | Global |

See [IDE Setup](./ide-setup.md) for the exact JSON structure.

## Local files

memctl creates these files locally:

| File | Purpose |
|------|---------|
| `~/.memctl/config.json` | Credentials and project mappings |
| `~/.memctl/cache.db` | SQLite offline cache (per org/project) |
| `~/.memctl/pending-writes.json` | Queued writes from offline mode |

The cache database and pending writes are managed automatically. You don't need to touch them. If you want to reset the local cache, delete `cache.db` and it will be recreated on next run.

## Self-hosted API URL

If you're running memctl locally or self-hosting, set the API URL:

```bash
export MEMCTL_API_URL=http://localhost:3000/api/v1
```

Or in your IDE config:

```json
{
  "env": {
    "MEMCTL_API_URL": "http://localhost:3000/api/v1"
  }
}
```

The default is `https://memctl.com/api/v1`.
