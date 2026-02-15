import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./api-client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

export function createServer(config: {
  baseUrl: string;
  token: string;
  org: string;
  project: string;
}) {
  const server = new McpServer({
    name: "memctl",
    version: "0.1.0",
  });

  const client = new ApiClient(config);

  registerTools(server, client);
  registerResources(server, client);

  return server;
}
