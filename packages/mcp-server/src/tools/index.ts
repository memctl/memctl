import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import {
  AGENT_CONTEXT_TYPE_INFO,
  AGENT_CONTEXT_TYPES,
  buildAgentContextKey,
  buildBranchPlanKey,
  extractAgentContextEntries,
  getBranchInfo,
  listAllMemories,
  normalizeAgentContextId,
} from "../agent-context.js";

const agentContextTypeSchema = z.enum(AGENT_CONTEXT_TYPES);

function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResponse(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
    isError: true,
  };
}

function hasMemoryFullError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /memory limit reached/i.test(message);
}

function toFiniteLimitText(limit: number) {
  return Number.isFinite(limit) ? String(limit) : "unlimited";
}

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
        return textResponse(`Memory stored with key: ${key}`);
      } catch (error) {
        if (hasMemoryFullError(error)) {
          return errorResponse(
            "Error storing memory",
            `${error instanceof Error ? error.message : String(error)} Use memory_delete or agent_functionality_delete to remove unused memories first.`,
          );
        }
        return errorResponse("Error storing memory", error);
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
        return textResponse(JSON.stringify(memory, null, 2));
      } catch (error) {
        return errorResponse("Error retrieving memory", error);
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
        return textResponse(JSON.stringify(results, null, 2));
      } catch (error) {
        return errorResponse("Error searching memories", error);
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
        return textResponse(JSON.stringify(results, null, 2));
      } catch (error) {
        return errorResponse("Error listing memories", error);
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
        return textResponse(`Memory deleted: ${key}`);
      } catch (error) {
        return errorResponse("Error deleting memory", error);
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
        return textResponse(`Memory updated: ${key}`);
      } catch (error) {
        return errorResponse("Error updating memory", error);
      }
    },
  );

  server.tool(
    "memory_capacity",
    "Return memory usage/limit and whether memory is full",
    {},
    async () => {
      try {
        const capacity = await client.getMemoryCapacity();
        const guidance = capacity.isFull
          ? "Memory is full. Delete unused memories before adding new ones."
          : "Memory has available capacity.";

        return textResponse(
          JSON.stringify(
            {
              ...capacity,
              guidance,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error getting memory capacity", error);
      }
    },
  );

  server.tool(
    "agent_functionality_list",
    "List agent functionality types and saved context entries (replacement for AGENTS.md/CLAUDE.md style guidance)",
    {
      type: agentContextTypeSchema
        .optional()
        .describe("Optional type filter"),
      includeContentPreview: z
        .boolean()
        .default(false)
        .describe("Include a short content preview"),
      limitPerType: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum entries to return per type"),
    },
    async ({ type, includeContentPreview, limitPerType }) => {
      try {
        const [allMemories, branchInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
        ]);
        const entries = extractAgentContextEntries(allMemories);
        const capacity = await client.getMemoryCapacity().catch(() => null);

        const selectedTypes = type ? [type] : AGENT_CONTEXT_TYPES;

        const result = selectedTypes.map((entryType) => {
          const items = entries
            .filter((entry) => entry.type === entryType)
            .slice(0, limitPerType)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              key: entry.key,
              updatedAt: entry.updatedAt,
              preview: includeContentPreview
                ? entry.content.slice(0, 240)
                : undefined,
            }));

          return {
            type: entryType,
            label: AGENT_CONTEXT_TYPE_INFO[entryType].label,
            description: AGENT_CONTEXT_TYPE_INFO[entryType].description,
            count: entries.filter((entry) => entry.type === entryType).length,
            items,
          };
        });

        const memoryStatus = capacity
          ? {
              ...capacity,
              guidance: capacity.isFull
                ? `Memory is full (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Delete unused entries before storing new ones.`
                : `Memory available (${capacity.used}/${toFiniteLimitText(capacity.limit)}).`,
            }
          : null;

        return textResponse(
          JSON.stringify(
            {
              functionalityTypes: result,
              currentBranch: branchInfo,
              memoryStatus,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error listing agent functionalities", error);
      }
    },
  );

  server.tool(
    "agent_functionality_get",
    "Get detailed functionality data for one type or one specific item",
    {
      type: agentContextTypeSchema.describe("Functionality type"),
      id: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .describe("Specific functionality ID"),
      includeContent: z
        .boolean()
        .default(true)
        .describe("Include full content"),
    },
    async ({ type, id, includeContent }) => {
      try {
        if (id) {
          const key = buildAgentContextKey(type, id);
          const memory = await client.getMemory(key);
          return textResponse(JSON.stringify(memory, null, 2));
        }

        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories).filter(
          (entry) => entry.type === type,
        );

        return textResponse(
          JSON.stringify(
            {
              type,
              label: AGENT_CONTEXT_TYPE_INFO[type].label,
              description: AGENT_CONTEXT_TYPE_INFO[type].description,
              count: entries.length,
              items: entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                key: entry.key,
                metadata: entry.metadata,
                updatedAt: entry.updatedAt,
                content: includeContent ? entry.content : undefined,
              })),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error retrieving agent functionality", error);
      }
    },
  );

  server.tool(
    "agent_functionality_set",
    "Create or update structured agent functionality data",
    {
      type: agentContextTypeSchema.describe("Functionality type"),
      id: z
        .string()
        .min(1)
        .max(128)
        .describe("Functionality ID (slug-like identifier)"),
      title: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .describe("Human-readable title"),
      content: z.string().min(1).describe("Detailed content"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional metadata object"),
    },
    async ({ type, id, title, content, metadata }) => {
      try {
        const normalizedId = normalizeAgentContextId(id);
        if (!normalizedId) {
          return errorResponse(
            "Error storing agent functionality",
            "ID is empty after normalization.",
          );
        }

        const key = buildAgentContextKey(type, normalizedId);
        await client.storeMemory(key, content, {
          ...metadata,
          scope: "agent_functionality",
          type,
          id: normalizedId,
          title: title ?? normalizedId,
          updatedByTool: "agent_functionality_set",
          updatedAt: new Date().toISOString(),
        });

        const capacity = await client.getMemoryCapacity().catch(() => null);
        const message = capacity
          ? `Functionality saved: ${key} (memory ${capacity.used}/${toFiniteLimitText(capacity.limit)})`
          : `Functionality saved: ${key}`;

        return textResponse(message);
      } catch (error) {
        if (hasMemoryFullError(error)) {
          return errorResponse(
            "Error storing agent functionality",
            `${error instanceof Error ? error.message : String(error)} Delete old functionality items with agent_functionality_delete, then retry.`,
          );
        }
        return errorResponse("Error storing agent functionality", error);
      }
    },
  );

  server.tool(
    "agent_functionality_delete",
    "Delete a structured agent functionality item",
    {
      type: agentContextTypeSchema.describe("Functionality type"),
      id: z
        .string()
        .min(1)
        .max(128)
        .describe("Functionality ID"),
    },
    async ({ type, id }) => {
      try {
        const key = buildAgentContextKey(type, id);
        await client.deleteMemory(key);
        return textResponse(`Functionality deleted: ${key}`);
      } catch (error) {
        return errorResponse("Error deleting agent functionality", error);
      }
    },
  );

  server.tool(
    "branch_context_get",
    "Get current branch information and branch implementation plan",
    {
      branch: z
        .string()
        .min(1)
        .optional()
        .describe("Branch name (defaults to current git branch)"),
    },
    async ({ branch }) => {
      try {
        const currentBranchInfo = await getBranchInfo();
        const selectedBranch = branch ?? currentBranchInfo?.branch;

        if (!selectedBranch) {
          return errorResponse(
            "Error reading branch context",
            "No git branch detected. Pass `branch` explicitly.",
          );
        }

        const key = buildBranchPlanKey(selectedBranch);
        const branchPlan = await client.getMemory(key).catch(() => null);

        return textResponse(
          JSON.stringify(
            {
              currentBranch: currentBranchInfo,
              selectedBranch,
              branchPlanKey: key,
              branchPlan,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error retrieving branch context", error);
      }
    },
  );

  server.tool(
    "branch_context_set",
    "Set what needs to be implemented for a branch",
    {
      branch: z
        .string()
        .min(1)
        .optional()
        .describe("Branch name (defaults to current git branch)"),
      content: z.string().min(1).describe("Implementation plan for the branch"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional metadata object"),
    },
    async ({ branch, content, metadata }) => {
      try {
        const currentBranchInfo = await getBranchInfo();
        const selectedBranch = branch ?? currentBranchInfo?.branch;

        if (!selectedBranch) {
          return errorResponse(
            "Error storing branch context",
            "No git branch detected. Pass `branch` explicitly.",
          );
        }

        const key = buildBranchPlanKey(selectedBranch);
        await client.storeMemory(key, content, {
          ...metadata,
          scope: "agent_functionality",
          type: "branch_plan",
          branch: selectedBranch,
          title: `Branch plan: ${selectedBranch}`,
          updatedByTool: "branch_context_set",
          updatedAt: new Date().toISOString(),
        });

        return textResponse(`Branch context saved: ${key}`);
      } catch (error) {
        if (hasMemoryFullError(error)) {
          return errorResponse(
            "Error storing branch context",
            `${error instanceof Error ? error.message : String(error)} Delete old memories before saving a new branch plan.`,
          );
        }
        return errorResponse("Error storing branch context", error);
      }
    },
  );

  server.tool(
    "branch_context_delete",
    "Delete the implementation plan for a branch",
    {
      branch: z
        .string()
        .min(1)
        .optional()
        .describe("Branch name (defaults to current git branch)"),
    },
    async ({ branch }) => {
      try {
        const currentBranchInfo = await getBranchInfo();
        const selectedBranch = branch ?? currentBranchInfo?.branch;

        if (!selectedBranch) {
          return errorResponse(
            "Error deleting branch context",
            "No git branch detected. Pass `branch` explicitly.",
          );
        }

        const key = buildBranchPlanKey(selectedBranch);
        await client.deleteMemory(key);
        return textResponse(`Branch context deleted: ${key}`);
      } catch (error) {
        return errorResponse("Error deleting branch context", error);
      }
    },
  );
}
