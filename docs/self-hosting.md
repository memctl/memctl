# Self-Hosting

Run memctl on your own infrastructure with no billing, no Stripe, and unlimited everything.

## What self-hosted mode does

When `SELF_HOSTED=true`:

- All new organizations are created with **enterprise** plan limits (unlimited projects, members, memories, API rate)
- **Billing is completely disabled** — no Stripe customer creation, no checkout, no webhooks
- The billing page shows a simple "Self-Hosted (Unlimited)" view instead of plan cards
- Existing organizations automatically get unlimited limits on next access
- **Invite-only access** — only users explicitly invited by an org owner/admin can sign in
- **Emails are suppressed** — no welcome or notification emails sent without a configured email provider

## Quick start with Docker Compose

```bash
git clone https://github.com/your-org/memctl.git
cd memctl

cat > .env <<'EOF'
# Database (local libSQL)
TURSO_DATABASE_URL=http://localhost:8080
TURSO_AUTH_TOKEN=

# Auth — use dev bypass for quick testing, or set up GitHub OAuth
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000

# Self-hosted mode
SELF_HOSTED=true
NEXT_PUBLIC_SELF_HOSTED=true

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MEMCTL_API_URL=http://localhost:3000/api/v1
EOF

docker compose up -d
docker compose exec web pnpm db:push
```

Open http://localhost:3000 — you should be auto-logged in with the dev bypass user.

## Required env vars (minimal set)

| Variable | Value | Notes |
|----------|-------|-------|
| `TURSO_DATABASE_URL` | `http://localhost:8080` | Or any libSQL/Turso URL |
| `BETTER_AUTH_SECRET` | random string | Minimum 32 characters |
| `BETTER_AUTH_URL` | your app URL | e.g. `http://localhost:3000` |
| `SELF_HOSTED` | `true` | Enables self-hosted mode |
| `NEXT_PUBLIC_SELF_HOSTED` | `true` | Client-side self-hosted flag |
| `NEXT_PUBLIC_APP_URL` | your app URL | e.g. `http://localhost:3000` |

## Auth options

### Dev bypass (simplest — personal use)

Set `DEV_AUTH_BYPASS=true` and `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`. A dev user and organization are created automatically. In self-hosted mode, dev bypass works in **production** too (not just `NODE_ENV=development`), so a single-user Docker deployment "just works" without GitHub OAuth.

### GitHub OAuth (team use)

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` with a GitHub OAuth app. The callback URL should be `{BETTER_AUTH_URL}/api/auth/callback/github`.

**Access is invite-only.** In self-hosted mode, users cannot self-register or create their own organizations. The flow is:

1. The org owner (dev bypass user, or first GitHub user) creates the organization
2. Owner/admins go to **Members > Invite** and add team members by email
3. Invited users sign in via GitHub — they're automatically added to the organization
4. Users who sign in without an invitation see a "Waiting for invitation" page

This ensures only explicitly invited users can access your self-hosted instance.

### Combining dev bypass + GitHub OAuth

You can use both: dev bypass creates the initial owner account and org, then real users sign in via GitHub OAuth after being invited. This is useful when bootstrapping a team deployment.

## Emails

In self-hosted mode without `RESEND_API_KEY`, all emails (welcome, magic link, etc.) are silently skipped — no error logs, no noise. If you do configure Resend, emails work normally.

## What's disabled

- **Billing page**: shows "Self-Hosted (Unlimited)" instead of Stripe plan cards
- **Checkout API**: returns 400 "Billing is not enabled"
- **Portal API**: returns 400 "Billing is not enabled"
- **Stripe webhook**: returns 400 "Billing is not enabled"
- **Stripe customer creation**: skipped during org creation
- **Self-registration**: users must be invited by an org owner/admin

No Stripe or email env vars are needed in self-hosted mode.

## CLI / MCP server setup

The memctl CLI and MCP server work with self-hosted instances out of the box. Point them to your self-hosted API URL:

### Option 1: Environment variables

```bash
export MEMCTL_API_URL=http://localhost:3000/api/v1
export MEMCTL_TOKEN=your-api-token
export MEMCTL_ORG=your-org-slug
export MEMCTL_PROJECT=your-project-slug
```

### Option 2: Interactive setup

```bash
memctl init
```

When prompted for the API URL, enter your self-hosted URL (e.g. `http://localhost:3000/api/v1`). The CLI will test connectivity before saving.

### Option 3: IDE MCP config

For Claude Code (`.claude/mcp.json`), Cursor (`.cursor/mcp.json`), or Windsurf:

```json
{
  "mcpServers": {
    "memctl": {
      "command": "npx",
      "args": ["-y", "memctl@latest"],
      "env": {
        "MEMCTL_TOKEN": "your-api-token",
        "MEMCTL_API_URL": "http://localhost:3000/api/v1",
        "MEMCTL_ORG": "your-org-slug",
        "MEMCTL_PROJECT": "your-project-slug"
      }
    }
  }
}
```

### Verify connectivity

```bash
memctl doctor
```

This checks config, API connectivity, auth, and org/project access. All features (offline cache, incremental sync, pending writes) work identically with self-hosted instances.

## Invitation expiry

Invitations expire after a configurable period (1-7 days, default 7). Expired invitations are automatically filtered out — they won't be accepted even if the invited user signs in after expiry. Admins can set the expiry duration when sending each invitation, and can revoke pending invitations at any time.
