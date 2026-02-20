#!/usr/bin/env node
export {};

const args = process.argv.slice(2);
const command = args[0];

// If a CLI command is given (and it's not "serve"), run the CLI
const cliCommands = [
  "list", "get", "search", "export", "import", "snapshot", "snapshots",
  "capacity", "cleanup", "lifecycle", "help", "--help", "-h",
];

if (command && cliCommands.includes(command)) {
  const { runCli } = await import("./cli.js");
  await runCli(args);
} else {
  // Default: start MCP server (also handles explicit "serve" command)
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createServer } = await import("./server.js");

  const baseUrl = process.env.MEMCTL_API_URL ?? "https://memctl.com/api/v1";
  const token = process.env.MEMCTL_TOKEN;
  const org = process.env.MEMCTL_ORG;
  const project = process.env.MEMCTL_PROJECT;

  if (!token) {
    console.error("MEMCTL_TOKEN is required");
    process.exit(1);
  }

  if (!org) {
    console.error("MEMCTL_ORG is required");
    process.exit(1);
  }

  if (!project) {
    console.error("MEMCTL_PROJECT is required");
    process.exit(1);
  }

  const server = createServer({ baseUrl, token, org, project });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
