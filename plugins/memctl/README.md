# memctl

Claude Code plugin for automatic high-signal memory capture in memctl.

## Install from this repository marketplace

1. Add the memctl marketplace:

```bash
/plugin marketplace add memctl/memctl
```

2. Install plugin:

```bash
/plugin install memctl@memctl
```

## Required MCP config

Make sure your Claude MCP config includes the `memctl` server with:

- `MEMCTL_ORG`
- `MEMCTL_PROJECT`
- `MEMCTL_API_URL` (optional if default)
- `MEMCTL_TOKEN` (or use `memctl auth`)
