# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in memctl, please report it responsibly. **Do not open a public issue.**

Email: **security@memctl.com**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your report within 48 hours and aim to provide a fix or mitigation within 7 days for critical issues.

## Scope

This policy covers:

- The memctl API server (`apps/web/`)
- The memctl CLI and MCP server (`packages/cli/`)
- The hosted service at memctl.com
- Authentication and authorization logic
- Data storage and access controls

## What we consider vulnerabilities

- Authentication bypass or token leakage
- Authorization flaws (accessing other users' data, org/project boundary violations)
- SQL injection or other injection attacks
- Cross-site scripting (XSS) in the dashboard
- Server-side request forgery (SSRF)
- Insecure handling of secrets (API tokens, webhook secrets, auth credentials)
- Denial of service through API abuse beyond rate limiting
- Data exposure through error messages or logs
- Webhook signature bypass

## What is not in scope

- Rate limiting thresholds (these are configurable per plan)
- Vulnerabilities in third-party dependencies that don't affect memctl's usage of them
- Social engineering attacks
- Issues that require physical access to the server

## Security architecture

### Authentication

- **Dashboard:** GitHub OAuth via Better Auth with session tokens
- **API:** Bearer tokens (SHA-256 hashed at rest, never stored in plaintext)
- **Admin:** Magic link email authentication restricted to `@memctl.com` addresses
- **Dev bypass:** Local-only auth bypass disabled in production (`DEV_AUTH_BYPASS` env var)

### Authorization

- API requests require `Authorization`, `X-Org-Slug`, and `X-Project-Slug` headers
- Org membership is verified on every request
- Project access is checked: owners/admins see all projects, members only see assigned projects
- Admin endpoints are restricted to users with `is_admin` flag

### Data isolation

- Memories are scoped to a project within an organization
- All queries filter by `projectId` — there is no way to access another project's data through the API
- Cross-project search (`search-org`) is restricted to projects within the user's org

### Secrets

- API tokens are hashed with SHA-256 before storage
- Webhook secrets are stored encrypted and used for HMAC-SHA256 signing
- The `BETTER_AUTH_SECRET` must be kept secret — it signs session tokens
- The `.env` file should never be committed to version control

### Rate limiting

- Sliding-window rate limiter per authenticated user
- Limits scale by plan tier (60/min free through 10K/min scale)
- Returns `429` with `Retry-After` header when exceeded

### Logging

- Structured JSON logging with request IDs for audit trails
- No sensitive data (tokens, passwords, full memory content) in logs
- Activity logs track tool usage per session for accountability

## Supported versions

We provide security fixes for the latest release only. We recommend always running the latest version of memctl.

## Disclosure

After a fix is released, we will:

1. Credit the reporter (unless they prefer anonymity)
2. Publish a brief advisory describing the issue and fix
3. Notify affected users if data exposure occurred

## Contact

security@memctl.com
