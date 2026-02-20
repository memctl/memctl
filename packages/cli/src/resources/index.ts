import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import {
  BUILTIN_AGENT_CONTEXT_TYPES,
  buildBranchPlanKey,
  extractAgentContextEntries,
  getAllContextTypeInfo,
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
        const [allMemories, branchInfo, allTypeInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
          getAllContextTypeInfo(client),
        ]);
        const entries = extractAgentContextEntries(allMemories);
        const capacity = await client.getMemoryCapacity().catch(() => null);

        const functionalityTypes = Object.entries(allTypeInfo).map(([type, info]) => ({
          type,
          label: info.label,
          description: info.description,
          count: entries.filter((entry) => entry.type === type).length,
          items: entries
            .filter((entry) => entry.type === type)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              key: entry.key,
              priority: entry.priority,
              tags: entry.tags,
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

      try {
        const allTypeInfo = await getAllContextTypeInfo(client);
        const typeInfo = allTypeInfo[maybeType];

        if (!typeInfo) {
          return textContent(
            uri,
            "text/plain",
            `Error: unknown type "${maybeType}". Valid values: ${Object.keys(allTypeInfo).join(", ")}`,
          );
        }

        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories).filter(
          (entry) => entry.type === maybeType,
        );

        return textContent(
          uri,
          "application/json",
          JSON.stringify(
            {
              type: maybeType,
              label: typeInfo.label,
              description: typeInfo.description,
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

  server.resource(
    "agent-bootstrap",
    "agent://bootstrap",
    async (uri) => {
      try {
        const [allMemories, branchInfo, allTypeInfo, capacity] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
          getAllContextTypeInfo(client),
          client.getMemoryCapacity().catch(() => null),
        ]);

        const entries = extractAgentContextEntries(allMemories);

        const functionalityTypes = Object.entries(allTypeInfo).map(([type, info]) => ({
          type,
          label: info.label,
          description: info.description,
          count: entries.filter((e) => e.type === type).length,
          items: entries
            .filter((e) => e.type === type)
            .map((e) => ({
              id: e.id,
              title: e.title,
              key: e.key,
              priority: e.priority,
              tags: e.tags,
              content: e.content,
              updatedAt: e.updatedAt,
            })),
        }));

        let branchPlan = null;
        if (branchInfo?.branch) {
          const planKey = buildBranchPlanKey(branchInfo.branch);
          branchPlan = await client.getMemory(planKey).catch(() => null);
        }

        return textContent(
          uri,
          "application/json",
          JSON.stringify(
            {
              functionalityTypes,
              currentBranch: branchInfo,
              branchPlan,
              memoryStatus: capacity,
              availableTypes: Object.keys(allTypeInfo),
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
