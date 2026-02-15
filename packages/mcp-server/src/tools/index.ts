import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../api-client.js";

export function registerTools(server: McpServer, client: ApiClient) {
  server.tool(
    "memory_store",
    "Store a key-value memory for the current project",
    {
      key: z.string().describe("Unique key for the memory"),
      content: z.string().describe("Content to store"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional metadata object"),
    },
    async ({ key, content, metadata }) => {
      try {
        await client.storeMemory(key, content, metadata);
        return {
          content: [
            { type: "text" as const, text: `Memory stored with key: ${key}` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error storing memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "memory_get",
    "Retrieve a memory by key",
    {
      key: z.string().describe("Key of the memory to retrieve"),
    },
    async ({ key }) => {
      try {
        const memory = await client.getMemory(key);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(memory, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error retrieving memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "memory_search",
    "Search memories by query string",
    {
      query: z.string().describe("Search query"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum results to return"),
    },
    async ({ query, limit }) => {
      try {
        const results = await client.searchMemories(query, limit);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching memories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "memory_list",
    "List all memories for the current project",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(100)
        .describe("Maximum results to return"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Offset for pagination"),
    },
    async ({ limit, offset }) => {
      try {
        const results = await client.listMemories(limit, offset);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(results, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing memories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "memory_delete",
    "Delete a memory by key",
    {
      key: z.string().describe("Key of the memory to delete"),
    },
    async ({ key }) => {
      try {
        await client.deleteMemory(key);
        return {
          content: [
            { type: "text" as const, text: `Memory deleted: ${key}` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "memory_update",
    "Update an existing memory",
    {
      key: z.string().describe("Key of the memory to update"),
      content: z.string().optional().describe("New content"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("New metadata object"),
    },
    async ({ key, content, metadata }) => {
      try {
        await client.updateMemory(key, content, metadata);
        return {
          content: [
            { type: "text" as const, text: `Memory updated: ${key}` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
