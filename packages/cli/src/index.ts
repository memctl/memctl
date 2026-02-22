#!/usr/bin/env node
export {};

const args = process.argv.slice(2);
const command = args[0];

// If a CLI command is given (and it's not "serve"), run the CLI
const cliCommands = [
  "list", "get", "search", "export", "import", "snapshot", "snapshots",
  "capacity", "cleanup", "lifecycle", "init", "auth", "doctor", "help", "--help", "-h",
];

if (command && cliCommands.includes(command)) {
  const { runCli } = await import("./cli.js");
  await runCli(args);
} else {
  // Default: start MCP server (also handles explicit "serve" command)
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createServer } = await import("./server.js");
  const { loadConfigForCwd } = await import("./config.js");

  const resolved = await loadConfigForCwd();

  const baseUrl = resolved?.baseUrl ?? "https://memctl.com/api/v1";
  const token = resolved?.token;
  const org = resolved?.org;
  const project = resolved?.project;

  if (!token) {
    console.error("Authentication required. Run `memctl auth` to store your API token, or set MEMCTL_TOKEN.");
    process.exit(1);
  }

  if (!org) {
    console.error("MEMCTL_ORG is required. Set it in your MCP config env or run `memctl init`.");
    process.exit(1);
  }

  if (!project) {
    console.error("MEMCTL_PROJECT is required. Set it in your MCP config env or run `memctl init`.");
    process.exit(1);
  }

  const server = createServer({ baseUrl, token, org, project });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
