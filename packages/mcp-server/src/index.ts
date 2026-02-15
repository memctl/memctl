#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

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
