import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";

export function registerResources(server: McpServer, client: ApiClient) {
  server.resource(
    "project-memories",
    "memory://project/{slug}",
    async (uri) => {
      try {
        const memories = await client.listMemories(100, 0);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(memories, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  server.resource(
    "single-memory",
    "memory://project/{slug}/{key}",
    async (uri) => {
      const parts = uri.pathname.split("/");
      const key = parts[parts.length - 1];
      try {
        const memory = await client.getMemory(key);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(memory, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );
}
