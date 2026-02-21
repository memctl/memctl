# Troubleshooting

Common errors and fixes organized by area.

## CLI

### "MEMCTL_TOKEN is required"

**Cause:** No API token found in environment variables or config file.

**Fix:** Either set the env var or run the setup wizard:

```bash
export MEMCTL_TOKEN=your-token
# or
npx memctl init
```

### "MEMCTL_ORG is required" / "MEMCTL_PROJECT is required"

**Cause:** Org or project slug not set.

**Fix:** Set the env vars or run init:

```bash
export MEMCTL_ORG=your-org
export MEMCTL_PROJECT=your-project
# or
npx memctl init
```

### "Unknown command: ..."

**Cause:** Typo or unrecognized command.

**Fix:** Check `memctl help` for the list of valid commands.

### CLI outputs empty results

**Cause:** No memories stored yet, or wrong org/project.

**Fix:** Check your credentials with `memctl doctor`, then try `memctl capacity` to confirm you're connected to the right project.

---

## MCP Server

### IDE shows "memctl: failed to connect" or similar

**Cause:** The MCP server process failed to start.

**Fix:**

1. Check your IDE config file (`.claude/mcp.json`, `.cursor/mcp.json`, or `~/.codeium/windsurf/mcp_config.json`)
2. Verify the env vars in the config are correct
3. Test manually: `MEMCTL_TOKEN=... MEMCTL_ORG=... MEMCTL_PROJECT=... npx memctl` — it should start silently (waiting for MCP messages on stdin)
4. If using a local build, make sure you've run `pnpm --filter memctl build`

### "Cannot find module" when starting MCP server

**Cause:** The CLI wasn't built, or the path in the IDE config is wrong.

**Fix:**

```bash
pnpm --filter memctl build
```

Then verify the path in your IDE config points to the correct `dist/index.js`.

### Tools not showing up in IDE

**Cause:** The MCP server connected but tools weren't registered.

**Fix:**

1. Check that your API token, org, and project are valid (all three are required for the server to start)
2. Restart the IDE
3. Check IDE MCP server logs for errors

### "API error 401: ..."

**Cause:** Invalid or expired API token.

**Fix:** Generate a new token in the dashboard and update your config.

### "API error 403: ..."

**Cause:** Your user doesn't have access to the specified org or project.

**Fix:** Check that the org slug and project slug are correct, and that your account is a member.

### "API error 429: ..."

**Cause:** Rate limit exceeded.

**Fix:** Wait for the rate limit window to reset (check the `Retry-After` header). If you're hitting limits frequently, consider upgrading your plan. Use `session` tool's `rate_status` action to check current usage.

---

## Docker

### "env file .env not found"

**Cause:** No `.env` file in the project root.

**Fix:**

```bash
cp .env.example .env
# Edit .env with your values
```

### Port 3000 already in use

**Cause:** Another process is using port 3000.

**Fix:** Stop the other process, or change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Use 3001 on host
```

### Hot reload not working

**Cause:** File system events not propagating to the container.

**Fix:**

- On macOS/Windows: ensure Docker Desktop's file sharing includes the project directory
- Try `docker compose restart web`
- The compose file sets `WATCHPACK_POLLING=true` and `CHOKIDAR_USEPOLLING=true` as fallbacks

### "Module not found" after adding a dependency

**Cause:** The `node_modules` volume is stale.

**Fix:**

```bash
docker compose down -v
docker compose up --build
```

### Out of memory during build

**Cause:** Docker doesn't have enough memory allocated.

**Fix:** Increase Docker Desktop memory in Settings > Resources (4 GB+ recommended).

### "dialect is not a constructor" or libSQL errors

**Cause:** `TURSO_DATABASE_URL` is wrong inside the container.

**Fix:** Inside Docker, it should be `http://libsql:8080` (not `localhost`). The docker-compose.yml sets this automatically via the `environment` key.

### ERR_PNPM_ENOSPC

**Cause:** Docker ran out of disk space.

**Fix:**

```bash
docker system prune -a
docker compose down -v
docker compose up --build
```

### ERR_PNPM_EMFILE (too many open files)

**Cause:** File descriptor limit too low.

**Fix:** The latest docker-compose.yml sets `nofile` ulimits. Make sure you're using it:

```bash
docker compose down -v
docker compose up --build
```

---

## Authentication

### GitHub OAuth callback fails

**Cause:** The callback URL doesn't match what's registered in GitHub.

**Fix:** In your GitHub OAuth app settings, set the callback URL to exactly:

```
http://localhost:3000/api/auth/callback/github
```

### Dev bypass not working

**Cause:** Both server and client env vars must be set.

**Fix:** Make sure both are set in `.env`:

```env
DEV_AUTH_BYPASS=true
NEXT_PUBLIC_DEV_AUTH_BYPASS=true
```

Then restart the web server.

### Admin login doesn't work

**Cause:** Admin login uses magic links for `@memctl.com` emails.

**Fix options:**

1. **Dev bypass admin mode:** Set `DEV_AUTH_BYPASS_ADMIN=true`
2. **Magic link in logs:** Without `RESEND_API_KEY`, the magic link URL is logged to console. Run `docker compose logs -f web`, submit the admin login, and copy the URL from the `[DEV MAGIC LINK]` log line.
3. **Manual DB update:** Sign in with GitHub, then set `is_admin = 1` for your user in Drizzle Studio:

```bash
TURSO_DATABASE_URL=http://localhost:8080 TURSO_AUTH_TOKEN= pnpm --filter @memctl/db dlx drizzle-kit studio
```

---

## Database

### "table not found" or schema errors

**Cause:** Schema hasn't been pushed to the database.

**Fix:**

```bash
docker compose exec web pnpm db:push
```

### Schema mismatch after pulling changes

**Cause:** Someone changed the schema and you need to re-push.

**Fix:**

```bash
docker compose exec web pnpm db:push
```

### Drizzle Studio won't connect

**Cause:** Wrong database URL or the libsql container isn't running.

**Fix:** Make sure Docker is running, then use the host port:

```bash
TURSO_DATABASE_URL=http://localhost:8080 TURSO_AUTH_TOKEN= pnpm --filter @memctl/db dlx drizzle-kit studio
```

---

## Doctor output

`memctl doctor` runs diagnostics and reports issues. Here's what each check means:

| Check | Pass | Warning | Fail |
|-------|------|---------|------|
| Config file | `~/.memctl/config.json` exists | Missing (using env vars only) | — |
| Credentials | Token, org, project all present | — | Missing required value |
| API connectivity | API responds to health check | — | Unreachable |
| Auth token | Token accepted by API | — | Invalid or expired |
| Org/project access | Can read project capacity | — | Access denied |
| Memory capacity | Under limit | Approaching limit (>80%) | Full |
| Local cache | `cache.db` exists | Missing (will be created) | — |
| Pending writes | No queued writes | Has queued writes | — |

If doctor reports failures, address them in order — auth issues block everything downstream.
