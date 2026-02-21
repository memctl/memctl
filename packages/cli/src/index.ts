#!/usr/bin/env node
export {};

const args = process.argv.slice(2);
const command = args[0];

// If a CLI command is given (and it's not "serve"), run the CLI
const cliCommands = [
  "list", "get", "search", "export", "import", "snapshot", "snapshots",
  "capacity", "cleanup", "lifecycle", "init", "doctor", "help", "--help", "-h",
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
    console.error("MEMCTL_TOKEN is required. Run `memctl init` or set MEMCTL_TOKEN.");
    process.exit(1);
  }

  if (!org) {
    console.error("MEMCTL_ORG is required. Run `memctl init` or set MEMCTL_ORG.");
    process.exit(1);
  }

  if (!project) {
    console.error("MEMCTL_PROJECT is required. Run `memctl init` or set MEMCTL_PROJECT.");
    process.exit(1);
  }

  const server = createServer({ baseUrl, token, org, project });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
