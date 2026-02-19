import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import {
  AGENT_CONTEXT_TYPE_INFO,
  AGENT_CONTEXT_TYPES,
  buildBranchPlanKey,
  extractAgentContextEntries,
  getBranchInfo,
  listAllMemories,
} from "../agent-context.js";

function textContent(uri: URL, mimeType: string, text: string) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType,
        text,
      },
    ],
  };
}

function getPathSegments(uri: URL) {
  return uri.pathname.split("/").filter(Boolean);
}

export function registerResources(server: McpServer, client: ApiClient) {
  server.resource(
    "project-memories",
    "memory://project/{slug}",
    async (uri) => {
      try {
        const memories = await client.listMemories(100, 0);
        return textContent(uri, "application/json", JSON.stringify(memories, null, 2));
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  server.resource(
    "single-memory",
    "memory://project/{slug}/{key}",
    async (uri) => {
      const parts = getPathSegments(uri);
      const key = parts[parts.length - 1];
      try {
        const memory = await client.getMemory(key);
        return textContent(uri, "application/json", JSON.stringify(memory, null, 2));
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  server.resource(
    "memory-capacity",
    "memory://capacity",
    async (uri) => {
      try {
        const capacity = await client.getMemoryCapacity();
        return textContent(uri, "application/json", JSON.stringify(capacity, null, 2));
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  server.resource(
    "agent-functionalities",
    "agent://functionalities",
    async (uri) => {
      try {
        const [allMemories, branchInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
        ]);
        const entries = extractAgentContextEntries(allMemories);
        const capacity = await client.getMemoryCapacity().catch(() => null);

        const functionalityTypes = AGENT_CONTEXT_TYPES.map((type) => ({
          type,
          label: AGENT_CONTEXT_TYPE_INFO[type].label,
          description: AGENT_CONTEXT_TYPE_INFO[type].description,
          count: entries.filter((entry) => entry.type === type).length,
          items: entries
            .filter((entry) => entry.type === type)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              key: entry.key,
              updatedAt: entry.updatedAt,
            })),
        }));

        return textContent(
          uri,
          "application/json",
          JSON.stringify(
            {
              functionalityTypes,
              currentBranch: branchInfo,
              memoryStatus: capacity,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  server.resource(
    "agent-functionality-type",
    "agent://functionalities/{type}",
    async (uri) => {
      const segments = getPathSegments(uri);
      const maybeType = segments[0];
      const type = AGENT_CONTEXT_TYPES.find((entry) => entry === maybeType);

      if (!type) {
        return textContent(
          uri,
          "text/plain",
          `Error: unknown type "${maybeType}". Valid values: ${AGENT_CONTEXT_TYPES.join(", ")}`,
        );
      }

      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories).filter(
          (entry) => entry.type === type,
        );

        return textContent(
          uri,
          "application/json",
          JSON.stringify(
            {
              type,
              label: AGENT_CONTEXT_TYPE_INFO[type].label,
              description: AGENT_CONTEXT_TYPE_INFO[type].description,
              count: entries.length,
              items: entries,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  server.resource(
    "agent-branch-current",
    "agent://branch/current",
    async (uri) => {
      try {
        const branchInfo = await getBranchInfo();
        if (!branchInfo) {
          return textContent(
            uri,
            "application/json",
            JSON.stringify(
              {
                branch: null,
                message:
                  "No git branch detected. Use branch_context_get with a branch argument.",
              },
              null,
              2,
            ),
          );
        }

        const branchPlanKey = buildBranchPlanKey(branchInfo.branch);
        const branchPlan = await client.getMemory(branchPlanKey).catch(() => null);
        return textContent(
          uri,
          "application/json",
          JSON.stringify(
            {
              ...branchInfo,
              branchPlanKey,
              branchPlan,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return textContent(
          uri,
          "text/plain",
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
