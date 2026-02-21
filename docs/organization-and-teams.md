# Organization & Teams

memctl is organized around organizations and projects. Organizations own projects, manage billing, and can share context across projects.

## Structure

```
Organization
├── Members (owner, admin, member)
├── Projects
│   ├── Memories
│   ├── Context entries
│   ├── Session logs
│   └── Activity logs
├── Org defaults
├── Project templates
└── Billing (Stripe plan)
```

## Organizations

Every memctl account belongs to at least one organization. Organizations have:

- A **name** and URL **slug**
- An **owner** (the creator)
- A **plan** (Free, Lite, Pro, Business, Scale, Enterprise)
- **Members** with roles

Create an org:

```bash
curl -X POST https://memctl.com/api/v1/orgs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Team", "slug": "my-team"}'
```

## Roles

| Role | Permissions |
|------|------------|
| **owner** | Full access. Manage billing, members, all projects. |
| **admin** | Manage members and all projects. Cannot change billing. |
| **member** | Access only assigned projects. |

Owners and admins can access all projects. Members must be explicitly assigned to projects.

## Projects

Projects live inside organizations. Each project has its own:

- Memory store (isolated from other projects)
- Context entries
- Session logs and activity logs
- Capacity limits (based on the org's plan)

Project slugs are unique within an organization.

```bash
curl -X POST https://memctl.com/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Org-Slug: my-team" \
  -d '{"name": "Backend API", "slug": "backend-api"}'
```

## Plan limits

| Plan | Price | Projects | Members | Memory/Project | Memory/Org | API Calls/mo | Rate/min |
|------|-------|----------|---------|---------------|------------|-------------|----------|
| Free | $0 | 3 | 1 | 200 | 500 | Unlimited | 60 |
| Lite | $5/mo | 10 | 3 | 1,000 | 10,000 | Unlimited | 300 |
| Pro | $20/mo | 25 | 10 | 5,000 | 100,000 | Unlimited | 1,000 |
| Business | $59/mo | 100 | 30 | 10,000 | 500,000 | Unlimited | 3,000 |
| Scale | $149/mo | 500 | 100 | 25,000 | 2,000,000 | Unlimited | 10,000 |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

## Org defaults

Org defaults are memory entries that can be applied to any project in the org. Useful for org-wide standards.

### Setting defaults

```json
{
  "tool": "org",
  "action": "defaults_set",
  "key": "agent/context/coding_style/org-standard",
  "content": "All projects:\n- TypeScript strict mode\n- ESLint + Prettier\n- No default exports",
  "priority": 80,
  "tags": ["coding_style"]
}
```

### Applying defaults

```json
{
  "tool": "org",
  "action": "defaults_apply"
}
```

This copies all org defaults into the current project. Existing keys are updated; new keys are created.

### Listing defaults

```json
{
  "tool": "org",
  "action": "defaults_list"
}
```

## Project templates

Templates are reusable sets of memory entries that can be applied to new projects.

### Creating a template

```json
{
  "tool": "org",
  "action": "template_create",
  "name": "React Starter",
  "description": "Standard context for React projects",
  "data": [
    {
      "key": "agent/context/coding_style/react",
      "content": "- Functional components only\n- Use hooks for state",
      "priority": 80,
      "tags": ["react", "coding_style"]
    },
    {
      "key": "agent/context/testing/react",
      "content": "- Use React Testing Library\n- Test behavior, not implementation",
      "priority": 70,
      "tags": ["react", "testing"]
    }
  ]
}
```

### Applying a template

```json
{
  "tool": "org",
  "action": "template_apply",
  "templateId": "template-id"
}
```

### Listing templates

```json
{
  "tool": "org",
  "action": "template_list"
}
```

Returns both built-in and custom templates.

## Cross-project search

Search across all projects in the org:

```json
{
  "tool": "context",
  "action": "search_org",
  "query": "authentication patterns",
  "limit": 50
}
```

Results are grouped by project. Useful for finding how different projects solve similar problems.

## Context diff

Compare agent context between two projects:

```json
{
  "tool": "org",
  "action": "context_diff",
  "projectA": "backend-api",
  "projectB": "frontend-app"
}
```

Returns:

- Keys unique to project A
- Keys unique to project B
- Shared keys (with whether content matches or differs)
- Statistics (totals, overlaps)

Useful for standardization or for understanding how context diverges across projects.

## Member management

### Inviting members

Via the dashboard or API:

```bash
curl -X POST https://memctl.com/api/v1/orgs/my-team/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "role": "member"}'
```

### Project assignment

Members (non-admin) only see projects they're assigned to. Owners and admins see all projects.

Project assignment is managed through the dashboard or the member projects endpoint:

```
GET /orgs/{slug}/members/{memberId}/projects
```
