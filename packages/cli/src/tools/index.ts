import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import {
  AGENT_CONTEXT_TYPE_INFO,
  BUILTIN_AGENT_CONTEXT_TYPES,
  buildAgentContextKey,
  buildBranchPlanKey,
  extractAgentContextEntries,
  getAllContextTypeInfo,
  getAllContextTypeSlugs,
  getBranchInfo,
  invalidateCustomTypesCache,
  listAllMemories,
  normalizeAgentContextId,
  parseAgentsMd,
} from "../agent-context.js";

const execFileAsync = promisify(execFile);

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

function formatCapacityGuidance(capacity: {
  used: number;
  limit: number;
  orgUsed: number;
  orgLimit: number;
  isFull: boolean;
  isSoftFull: boolean;
  isApproaching: boolean;
}) {
  if (capacity.isFull) {
    return `Organization memory limit reached (${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}). Delete or archive unused memories before storing new ones.`;
  }
  if (capacity.isSoftFull) {
    return `Project soft limit reached (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Consider archiving old memories. Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
  }
  if (capacity.isApproaching) {
    return `Approaching project limit (${capacity.used}/${toFiniteLimitText(capacity.limit)}). Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
  }
  return `Memory available. Project: ${capacity.used}/${toFiniteLimitText(capacity.limit)}, Org: ${capacity.orgUsed}/${toFiniteLimitText(capacity.orgLimit)}.`;
}

function matchGlob(filepath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${regex}$`).test(filepath);
}

export function registerTools(server: McpServer, client: ApiClient) {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOOTSTRAP — single-call context loader
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_bootstrap",
    "Load all agent context in a single call: all functionality entries, branch plan, memory capacity, and custom types. Use this at the start of every session instead of calling multiple tools.",
    {
      includeContent: z
        .boolean()
        .default(true)
        .describe("Include full content of each entry"),
      types: z
        .array(z.string())
        .optional()
        .describe("Only include these types (omit for all)"),
    },
    async ({ includeContent, types }) => {
      try {
        const [allMemories, branchInfo, capacity, allTypeInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
          client.getMemoryCapacity().catch(() => null),
          getAllContextTypeInfo(client),
        ]);

        const entries = extractAgentContextEntries(allMemories);
        const allTypeSlugs = Object.keys(allTypeInfo);
        const selectedTypes = types ?? allTypeSlugs;

        // Group entries by type
        const functionalityTypes = selectedTypes.map((type) => {
          const typeInfo = allTypeInfo[type];
          const typeEntries = entries.filter((e) => e.type === type);

          return {
            type,
            label: typeInfo?.label ?? type,
            description: typeInfo?.description ?? "",
            count: typeEntries.length,
            items: typeEntries.map((entry) => {
              const mem = allMemories.find((m) => m.key === entry.key);
              return {
                id: entry.id,
                title: entry.title,
                key: entry.key,
                priority: entry.priority,
                tags: entry.tags,
                isPinned: Boolean(mem?.pinnedAt),
                scope: mem?.scope ?? "project",
                updatedAt: entry.updatedAt,
                content: includeContent ? entry.content : undefined,
              };
            }),
          };
        });

        // Get branch plan if on a branch
        let branchPlan = null;
        if (branchInfo?.branch) {
          const planKey = buildBranchPlanKey(branchInfo.branch);
          branchPlan = await client.getMemory(planKey).catch(() => null);
        }

        const memoryStatus = capacity
          ? {
              ...capacity,
              guidance: formatCapacityGuidance(capacity),
            }
          : null;

        return textResponse(
          JSON.stringify(
            {
              functionalityTypes,
              currentBranch: branchInfo,
              branchPlan,
              memoryStatus,
              availableTypes: allTypeSlugs,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error bootstrapping agent context", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY CRUD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_store",
    "Store a key-value memory for the current project. Use scope='shared' to make it visible across all projects in the org (opt-in).",
    {
      key: z.string().describe("Unique key for the memory"),
      content: z.string().describe("Content to store"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional metadata object"),
      scope: z
        .enum(["project", "shared"])
        .default("project")
        .describe("'project' (default) for this project only, 'shared' for org-wide visibility"),
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("Priority (0-100, higher = more important)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags for categorization and filtering"),
      expiresAt: z
        .number()
        .optional()
        .describe("Unix timestamp when this memory should expire"),
    },
    async ({ key, content, metadata, scope, priority, tags, expiresAt }) => {
      try {
        // Check for near-duplicates before storing
        let dedupWarning = "";
        try {
          const similar = await client.findSimilar(content, key, 0.7);
          if (similar.similar.length > 0) {
            const top = similar.similar[0];
            dedupWarning = ` ⚠ Similar memory found: "${top.key}" (${Math.round(top.similarity * 100)}% match). Consider updating it instead.`;
          }
        } catch {
          // Dedup check is best-effort
        }

        await client.storeMemory(key, content, metadata, { scope, priority, tags, expiresAt });
        const scopeMsg = scope === "shared" ? " [shared across org]" : "";
        return textResponse(`Memory stored with key: ${key}${scopeMsg}${dedupWarning}`);
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
    "Search memories using full-text search with optional tag and sort filters",
    {
      query: z.string().describe("Search query (uses FTS5 full-text search)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum results to return"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tags to filter by"),
      sort: z
        .enum(["updated", "priority", "created"])
        .optional()
        .describe("Sort order"),
      includeArchived: z
        .boolean()
        .default(false)
        .describe("Include archived memories"),
    },
    async ({ query, limit, tags, sort, includeArchived }) => {
      try {
        const results = await client.searchMemories(query, limit, {
          tags,
          sort,
          includeArchived,
        });
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
      sort: z
        .enum(["updated", "priority", "created"])
        .default("updated")
        .describe("Sort order"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tags to filter by"),
      includeArchived: z
        .boolean()
        .default(false)
        .describe("Include archived memories"),
    },
    async ({ limit, offset, sort, tags, includeArchived }) => {
      try {
        const results = await client.listMemories(limit, offset, {
          sort,
          tags,
          includeArchived,
        });
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
    "Update an existing memory (creates a version snapshot before updating)",
    {
      key: z.string().describe("Key of the memory to update"),
      content: z.string().optional().describe("New content"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("New metadata object"),
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("New priority"),
      tags: z
        .array(z.string())
        .optional()
        .describe("New tags"),
    },
    async ({ key, content, metadata, priority, tags }) => {
      try {
        await client.updateMemory(key, content, metadata, { priority, tags });
        return textResponse(`Memory updated: ${key}`);
      } catch (error) {
        return errorResponse("Error updating memory", error);
      }
    },
  );

  server.tool(
    "memory_capacity",
    "Return memory usage/limit for the current project and organization. Project limits are soft (warning), org limits are hard (blocking).",
    {},
    async () => {
      try {
        const capacity = await client.getMemoryCapacity();
        return textResponse(
          JSON.stringify(
            {
              ...capacity,
              guidance: formatCapacityGuidance(capacity),
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BULK OPERATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_bulk_get",
    "Retrieve multiple memories by keys in a single request (up to 50 keys)",
    {
      keys: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("Array of memory keys to retrieve"),
    },
    async ({ keys }) => {
      try {
        const result = await client.bulkGetMemories(keys);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error bulk-retrieving memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VERSIONING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_history",
    "View version history of a memory (shows previous content snapshots)",
    {
      key: z.string().describe("Key of the memory"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe("Maximum versions to return"),
    },
    async ({ key, limit }) => {
      try {
        const result = await client.getMemoryVersions(key, limit);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error retrieving memory history", error);
      }
    },
  );

  server.tool(
    "memory_restore",
    "Restore a memory to a previous version (current content is saved as a new version first)",
    {
      key: z.string().describe("Key of the memory"),
      version: z.number().int().min(1).describe("Version number to restore"),
    },
    async ({ key, version }) => {
      try {
        const result = await client.restoreMemoryVersion(key, version);
        return textResponse(
          JSON.stringify(result, null, 2),
        );
      } catch (error) {
        return errorResponse("Error restoring memory version", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ARCHIVE & CAPACITY OPTIMIZATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_archive",
    "Archive or unarchive a memory. Archived memories are hidden from normal listings and don't count toward capacity.",
    {
      key: z.string().describe("Key of the memory"),
      archive: z.boolean().describe("true to archive, false to unarchive"),
    },
    async ({ key, archive }) => {
      try {
        await client.archiveMemory(key, archive);
        return textResponse(
          `Memory ${archive ? "archived" : "unarchived"}: ${key}`,
        );
      } catch (error) {
        return errorResponse("Error archiving memory", error);
      }
    },
  );

  server.tool(
    "memory_cleanup",
    "Delete all expired memories (past their expiresAt date) to free capacity",
    {},
    async () => {
      try {
        const result = await client.cleanupExpired();
        return textResponse(
          `Cleanup complete: ${result.cleaned} expired memories removed.`,
        );
      } catch (error) {
        return errorResponse("Error cleaning up expired memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGENT FUNCTIONALITY (structured context)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_functionality_list",
    "List agent functionality types and saved context entries (replacement for AGENTS.md/CLAUDE.md style guidance). Supports both built-in and custom types.",
    {
      type: z
        .string()
        .optional()
        .describe("Optional type filter (built-in or custom slug)"),
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
        const [allMemories, branchInfo, allTypeInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
          getAllContextTypeInfo(client),
        ]);
        const entries = extractAgentContextEntries(allMemories);
        const capacity = await client.getMemoryCapacity().catch(() => null);

        const selectedTypes = type ? [type] : Object.keys(allTypeInfo);

        const result = selectedTypes.map((entryType) => {
          const typeInfo = allTypeInfo[entryType];
          const items = entries
            .filter((entry) => entry.type === entryType)
            .slice(0, limitPerType)
            .map((entry) => ({
              id: entry.id,
              title: entry.title,
              key: entry.key,
              priority: entry.priority,
              tags: entry.tags,
              updatedAt: entry.updatedAt,
              preview: includeContentPreview
                ? entry.content.slice(0, 240)
                : undefined,
            }));

          return {
            type: entryType,
            label: typeInfo?.label ?? entryType,
            description: typeInfo?.description ?? "",
            count: entries.filter((entry) => entry.type === entryType).length,
            items,
          };
        });

        const memoryStatus = capacity
          ? {
              ...capacity,
              guidance: formatCapacityGuidance(capacity),
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
      type: z.string().describe("Functionality type (built-in or custom slug)"),
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

        const typeInfo = await getAllContextTypeInfo(client);

        return textResponse(
          JSON.stringify(
            {
              type,
              label: typeInfo[type]?.label ?? type,
              description: typeInfo[type]?.description ?? "",
              count: entries.length,
              items: entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                key: entry.key,
                priority: entry.priority,
                tags: entry.tags,
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
      type: z.string().describe("Functionality type (built-in or custom slug)"),
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
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("Priority (0-100, higher = more important)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags for categorization"),
    },
    async ({ type, id, title, content, metadata, priority, tags }) => {
      try {
        const normalizedId = normalizeAgentContextId(id);
        if (!normalizedId) {
          return errorResponse(
            "Error storing agent functionality",
            "ID is empty after normalization.",
          );
        }

        const key = buildAgentContextKey(type, normalizedId);
        await client.storeMemory(
          key,
          content,
          {
            ...metadata,
            scope: "agent_functionality",
            type,
            id: normalizedId,
            title: title ?? normalizedId,
            updatedByTool: "agent_functionality_set",
            updatedAt: new Date().toISOString(),
          },
          { priority, tags },
        );

        const capacity = await client.getMemoryCapacity().catch(() => null);
        const message = capacity
          ? `Functionality saved: ${key} (project: ${capacity.used}/${toFiniteLimitText(capacity.limit)})`
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
      type: z.string().describe("Functionality type (built-in or custom slug)"),
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMART RETRIEVAL — file-path-aware context
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_context_for",
    "Get relevant agent context for specific files you're about to modify. Returns matching entries from architecture, coding_style, testing, constraints, and file_map based on file path patterns.",
    {
      filePaths: z
        .array(z.string())
        .min(1)
        .max(50)
        .describe("File paths you're about to modify"),
      types: z
        .array(z.string())
        .optional()
        .describe("Only search these types (default: all)"),
    },
    async ({ filePaths, types }) => {
      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);

        const relevantTypes = types ?? [
          "architecture",
          "coding_style",
          "testing",
          "constraints",
          "file_map",
          "folder_structure",
        ];

        // Build search terms from file paths
        const searchTerms: string[] = [];
        for (const fp of filePaths) {
          const parts = fp.split("/").filter(Boolean);
          searchTerms.push(...parts);
          // Also add file extension
          const ext = fp.split(".").pop();
          if (ext) searchTerms.push(ext);
        }
        const searchTermsLower = [...new Set(searchTerms.map((t) => t.toLowerCase()))];

        // Score each entry by relevance to the file paths
        const scored = entries
          .filter((e) => relevantTypes.includes(e.type))
          .map((entry) => {
            const searchableText = `${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
            let score = entry.priority;

            for (const term of searchTermsLower) {
              if (searchableText.includes(term)) {
                score += 10;
              }
            }

            // Exact file path match gets a big boost
            for (const fp of filePaths) {
              if (searchableText.includes(fp.toLowerCase())) {
                score += 50;
              }
            }

            return { entry, score };
          })
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);

        return textResponse(
          JSON.stringify(
            {
              filePaths,
              relevantContext: scored.map((s) => ({
                type: s.entry.type,
                id: s.entry.id,
                title: s.entry.title,
                relevanceScore: s.score,
                priority: s.entry.priority,
                tags: s.entry.tags,
                content: s.entry.content,
              })),
              totalMatches: scored.length,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error retrieving context for files", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGENTS.MD IMPORT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agents_md_import",
    "Import an AGENTS.md / CLAUDE.md file into structured agent functionality entries. Parses markdown headings and maps them to the appropriate context types.",
    {
      content: z
        .string()
        .min(1)
        .describe("The full text content of the AGENTS.md / CLAUDE.md file"),
      dryRun: z
        .boolean()
        .default(false)
        .describe("If true, returns parsed sections without storing them"),
      overwrite: z
        .boolean()
        .default(false)
        .describe("If true, overwrite existing entries with the same key"),
    },
    async ({ content, dryRun, overwrite }) => {
      try {
        const sections = parseAgentsMd(content);

        if (dryRun) {
          return textResponse(
            JSON.stringify(
              {
                dryRun: true,
                sections: sections.map((s) => ({
                  type: s.type,
                  id: s.id,
                  title: s.title,
                  contentLength: s.content.length,
                  key: buildAgentContextKey(s.type, s.id),
                })),
                totalSections: sections.length,
              },
              null,
              2,
            ),
          );
        }

        const results: Array<{ key: string; status: string }> = [];

        for (const section of sections) {
          const key = buildAgentContextKey(section.type, section.id);

          if (!overwrite) {
            // Check if exists
            try {
              await client.getMemory(key);
              results.push({ key, status: "skipped (exists)" });
              continue;
            } catch {
              // Doesn't exist, proceed
            }
          }

          try {
            await client.storeMemory(key, section.content, {
              scope: "agent_functionality",
              type: section.type,
              id: normalizeAgentContextId(section.id),
              title: section.title,
              importedFrom: "agents_md",
              updatedByTool: "agents_md_import",
              updatedAt: new Date().toISOString(),
            });
            results.push({ key, status: "imported" });
          } catch (error) {
            results.push({
              key,
              status: `error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        return textResponse(
          JSON.stringify(
            {
              imported: results.filter((r) => r.status === "imported").length,
              skipped: results.filter((r) => r.status.startsWith("skipped")).length,
              errors: results.filter((r) => r.status.startsWith("error")).length,
              details: results,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error importing agents.md", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CUSTOM CONTEXT TYPES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "context_type_create",
    "Create a custom agent context type beyond the built-in ones (coding_style, architecture, etc.)",
    {
      slug: z
        .string()
        .min(1)
        .max(64)
        .describe("Unique slug for the type (e.g., 'api_conventions')"),
      label: z.string().min(1).max(128).describe("Human-readable label"),
      description: z
        .string()
        .min(1)
        .max(512)
        .describe("Description of what this type covers"),
    },
    async ({ slug, label, description }) => {
      try {
        // Prevent overriding built-in types
        if ((BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]).includes(slug)) {
          return errorResponse(
            "Error creating context type",
            `"${slug}" is a built-in type and cannot be overridden.`,
          );
        }

        await client.createContextType({ slug, label, description });
        invalidateCustomTypesCache();
        return textResponse(
          `Custom context type created: ${slug} ("${label}")`,
        );
      } catch (error) {
        return errorResponse("Error creating context type", error);
      }
    },
  );

  server.tool(
    "context_type_list",
    "List all available context types (both built-in and custom)",
    {},
    async () => {
      try {
        const allTypeInfo = await getAllContextTypeInfo(client);
        const builtinSlugs = new Set(BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]);

        const types = Object.entries(allTypeInfo).map(([slug, info]) => ({
          slug,
          label: info.label,
          description: info.description,
          isBuiltin: builtinSlugs.has(slug),
        }));

        return textResponse(JSON.stringify({ types }, null, 2));
      } catch (error) {
        return errorResponse("Error listing context types", error);
      }
    },
  );

  server.tool(
    "context_type_delete",
    "Delete a custom context type (built-in types cannot be deleted)",
    {
      slug: z.string().describe("Slug of the custom type to delete"),
    },
    async ({ slug }) => {
      try {
        if ((BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]).includes(slug)) {
          return errorResponse(
            "Error deleting context type",
            `"${slug}" is a built-in type and cannot be deleted.`,
          );
        }

        await client.deleteContextType(slug);
        invalidateCustomTypesCache();
        return textResponse(`Custom context type deleted: ${slug}`);
      } catch (error) {
        return errorResponse("Error deleting context type", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BRANCH CONTEXT (enhanced)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "branch_context_get",
    "Get current branch information, implementation plan, and related context entries",
    {
      branch: z
        .string()
        .min(1)
        .optional()
        .describe("Branch name (defaults to current git branch)"),
      includeRelatedContext: z
        .boolean()
        .default(false)
        .describe("Also return agent context entries that mention this branch"),
    },
    async ({ branch, includeRelatedContext }) => {
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

        let relatedContext: Array<{
          type: string;
          id: string;
          title: string;
          relevanceScore: number;
        }> = [];

        if (includeRelatedContext) {
          const allMemories = await listAllMemories(client);
          const entries = extractAgentContextEntries(allMemories);
          const branchTerms = selectedBranch
            .split(/[-_/]/)
            .filter((t) => t.length > 2)
            .map((t) => t.toLowerCase());

          relatedContext = entries
            .filter((e) => e.type !== "branch_plan")
            .map((entry) => {
              const text = `${entry.title} ${entry.content}`.toLowerCase();
              let score = 0;
              for (const term of branchTerms) {
                if (text.includes(term)) score += 10;
              }
              if (text.includes(selectedBranch.toLowerCase())) score += 50;
              return { entry, score };
            })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((s) => ({
              type: s.entry.type,
              id: s.entry.id,
              title: s.entry.title,
              relevanceScore: s.score,
            }));
        }

        // Parse branch plan metadata for status tracking
        let planStatus = null;
        if (branchPlan && typeof branchPlan === "object") {
          const plan = branchPlan as { memory?: { metadata?: string } };
          if (plan.memory?.metadata) {
            try {
              const meta = typeof plan.memory.metadata === "string"
                ? JSON.parse(plan.memory.metadata)
                : plan.memory.metadata;
              planStatus = {
                status: meta.planStatus ?? "active",
                checklist: meta.checklist ?? null,
                completedItems: meta.completedItems ?? null,
                totalItems: meta.totalItems ?? null,
              };
            } catch {
              // ignore parse errors
            }
          }
        }

        return textResponse(
          JSON.stringify(
            {
              currentBranch: currentBranchInfo,
              selectedBranch,
              branchPlanKey: key,
              branchPlan,
              planStatus,
              relatedContext: includeRelatedContext ? relatedContext : undefined,
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
    "Set what needs to be implemented for a branch, with optional status and checklist tracking",
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
      status: z
        .enum(["planning", "in_progress", "review", "merged"])
        .optional()
        .describe("Plan status"),
      checklist: z
        .array(
          z.object({
            item: z.string(),
            done: z.boolean(),
          }),
        )
        .optional()
        .describe("Checklist of implementation items"),
    },
    async ({ branch, content, metadata, status, checklist }) => {
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
        const completedItems = checklist
          ? checklist.filter((c) => c.done).length
          : undefined;
        const totalItems = checklist ? checklist.length : undefined;

        await client.storeMemory(key, content, {
          ...metadata,
          scope: "agent_functionality",
          type: "branch_plan",
          branch: selectedBranch,
          title: `Branch plan: ${selectedBranch}`,
          planStatus: status ?? "in_progress",
          checklist: checklist ?? undefined,
          completedItems,
          totalItems,
          updatedByTool: "branch_context_set",
          updatedAt: new Date().toISOString(),
        });

        const statusMsg = status ? ` [${status}]` : "";
        const checklistMsg = checklist
          ? ` (${completedItems}/${totalItems} items done)`
          : "";

        return textResponse(
          `Branch context saved: ${key}${statusMsg}${checklistMsg}`,
        );
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCAN REPOSITORY — auto-generate file_map
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "scan_repository",
    "Scan the current repository and generate a structured file_map context entry. Uses git ls-files to walk the repo and groups files by directory/extension.",
    {
      maxFiles: z
        .number()
        .int()
        .min(10)
        .max(5000)
        .default(1000)
        .describe("Maximum files to include in the scan"),
      includePatterns: z
        .array(z.string())
        .optional()
        .describe("Glob patterns to include (e.g., ['src/**', 'lib/**'])"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("Glob patterns to exclude (e.g., ['node_modules/**', 'dist/**'])"),
      saveAsContext: z
        .boolean()
        .default(false)
        .describe("If true, save the result as an agent/context/file_map entry"),
    },
    async ({ maxFiles, includePatterns, excludePatterns, saveAsContext }) => {
      try {
        const args = ["ls-files", "--cached", "--others", "--exclude-standard"];
        const result = await execFileAsync("git", args, {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });

        let files = result.stdout.trim().split("\n").filter(Boolean);

        // Apply include patterns
        if (includePatterns && includePatterns.length > 0) {
          files = files.filter((f) =>
            includePatterns.some((p) => matchGlob(f, p)),
          );
        }

        // Apply exclude patterns
        if (excludePatterns && excludePatterns.length > 0) {
          files = files.filter(
            (f) => !excludePatterns.some((p) => matchGlob(f, p)),
          );
        }

        files = files.slice(0, maxFiles);

        // Group by top-level directory
        const byDir: Record<string, string[]> = {};
        const byExt: Record<string, number> = {};

        for (const file of files) {
          const parts = file.split("/");
          const topDir = parts.length > 1 ? parts[0] : ".";
          if (!byDir[topDir]) byDir[topDir] = [];
          byDir[topDir].push(file);

          const ext = file.includes(".") ? file.split(".").pop()! : "no-ext";
          byExt[ext] = (byExt[ext] ?? 0) + 1;
        }

        const fileMap = {
          totalFiles: files.length,
          directories: Object.entries(byDir)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([dir, dirFiles]) => ({
              directory: dir,
              fileCount: dirFiles.length,
              files: dirFiles.slice(0, 50),
              truncated: dirFiles.length > 50,
            })),
          extensionBreakdown: Object.entries(byExt)
            .sort((a, b) => b[1] - a[1])
            .map(([ext, count]) => ({ extension: ext, count })),
        };

        if (saveAsContext) {
          const content = JSON.stringify(fileMap, null, 2);
          const key = buildAgentContextKey("file_map", "auto-scan");
          await client.storeMemory(key, content, {
            scope: "agent_functionality",
            type: "file_map",
            id: "auto-scan",
            title: "Auto-scanned file map",
            updatedByTool: "scan_repository",
            updatedAt: new Date().toISOString(),
          });
          return textResponse(
            `Repository scanned: ${files.length} files. Saved as ${key}.`,
          );
        }

        return textResponse(JSON.stringify(fileMap, null, 2));
      } catch (error) {
        return errorResponse("Error scanning repository", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION HANDOFF — continuity log
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "session_start",
    "Register a new agent session. Retrieves the last session's handoff summary for continuity.",
    {
      sessionId: z.string().min(1).describe("Unique session identifier"),
    },
    async ({ sessionId }) => {
      try {
        const branchInfo = await getBranchInfo();

        // Get recent sessions for continuity
        const recentSessions = await client.getSessionLogs(5).catch(() => ({ sessionLogs: [] }));

        // Register this session
        await client.upsertSessionLog({
          sessionId,
          branch: branchInfo?.branch,
        });

        const lastSession = recentSessions.sessionLogs[0];
        const handoff = lastSession
          ? {
              previousSessionId: lastSession.sessionId,
              summary: lastSession.summary,
              branch: lastSession.branch,
              keysWritten: lastSession.keysWritten ? JSON.parse(lastSession.keysWritten) : [],
              endedAt: lastSession.endedAt,
            }
          : null;

        return textResponse(
          JSON.stringify(
            {
              sessionId,
              currentBranch: branchInfo,
              handoff,
              recentSessionCount: recentSessions.sessionLogs.length,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error starting session", error);
      }
    },
  );

  server.tool(
    "session_end",
    "End the current agent session with a handoff summary for the next session",
    {
      sessionId: z.string().min(1).describe("Session identifier from session_start"),
      summary: z
        .string()
        .min(1)
        .max(4096)
        .describe("Summary of what was accomplished, key decisions, and open questions for the next session"),
      keysRead: z
        .array(z.string())
        .optional()
        .describe("Memory keys that were read during this session"),
      keysWritten: z
        .array(z.string())
        .optional()
        .describe("Memory keys that were created or updated during this session"),
      toolsUsed: z
        .array(z.string())
        .optional()
        .describe("Tool names used during the session"),
    },
    async ({ sessionId, summary, keysRead, keysWritten, toolsUsed }) => {
      try {
        await client.upsertSessionLog({
          sessionId,
          summary,
          keysRead,
          keysWritten,
          toolsUsed,
          endedAt: Date.now(),
        });

        return textResponse(
          `Session ${sessionId} ended. Handoff summary saved for next session.`,
        );
      } catch (error) {
        return errorResponse("Error ending session", error);
      }
    },
  );

  server.tool(
    "session_history",
    "View recent session logs for continuity and context",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of recent sessions to retrieve"),
    },
    async ({ limit }) => {
      try {
        const result = await client.getSessionLogs(limit);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error retrieving session history", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY SUGGEST CLEANUP — relevance decay
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_suggest_cleanup",
    "Get suggestions for memories that could be archived or deleted based on staleness, low access count, and expiration. Helps maintain a clean, relevant memory store.",
    {
      staleDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Consider memories stale if not updated in this many days"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum suggestions to return"),
    },
    async ({ staleDays, limit }) => {
      try {
        const result = await client.suggestCleanup(staleDays, limit);
        const totalSuggestions = result.stale.length + result.expired.length;

        if (totalSuggestions === 0) {
          return textResponse("No cleanup suggestions. Memory store looks healthy.");
        }

        return textResponse(
          JSON.stringify(
            {
              summary: `Found ${result.stale.length} stale and ${result.expired.length} expired memories.`,
              ...result,
              actions: "Use memory_archive to archive stale memories, or memory_cleanup to remove expired ones.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error getting cleanup suggestions", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY WATCH — detect concurrent changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_watch",
    "Check if specific memory keys have been modified since a given timestamp. Useful for detecting concurrent changes by other agents or users.",
    {
      keys: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe("Memory keys to watch for changes"),
      since: z
        .number()
        .describe("Unix timestamp (ms) — check for changes after this time. Typically your session start time."),
    },
    async ({ keys, since }) => {
      try {
        const result = await client.watchMemories(keys, since);

        if (result.changed.length === 0) {
          return textResponse(
            `No changes detected for ${keys.length} watched keys since ${new Date(since).toISOString()}.`,
          );
        }

        return textResponse(
          JSON.stringify(
            {
              alert: `${result.changed.length} of ${keys.length} watched memories have been modified.`,
              ...result,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error watching memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTEXT BUDGET — token-aware retrieval
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "context_budget",
    "Retrieve agent context entries that fit within a token budget. Prioritizes by priority score and recency. Uses ~4 chars per token as estimate.",
    {
      maxTokens: z
        .number()
        .int()
        .min(100)
        .max(200000)
        .describe("Maximum token budget for the returned context"),
      types: z
        .array(z.string())
        .optional()
        .describe("Only include these context types (default: all)"),
      includeKeys: z
        .array(z.string())
        .optional()
        .describe("Always include these specific keys (they count against the budget)"),
    },
    async ({ maxTokens, types, includeKeys }) => {
      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);
        const allTypeInfo = await getAllContextTypeInfo(client);
        const selectedTypes = types ?? Object.keys(allTypeInfo);

        // Separate must-include entries
        const mustInclude = includeKeys
          ? entries.filter((e) => includeKeys.includes(e.key))
          : [];
        const candidates = entries
          .filter((e) => selectedTypes.includes(e.type))
          .filter((e) => !includeKeys?.includes(e.key));

        // Sort candidates by priority desc, then by updatedAt desc
        candidates.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          const aTime = typeof a.updatedAt === "string" ? new Date(a.updatedAt).getTime() : 0;
          const bTime = typeof b.updatedAt === "string" ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });

        const CHARS_PER_TOKEN = 4;
        let budgetRemaining = maxTokens * CHARS_PER_TOKEN;
        const selected: Array<{
          type: string;
          id: string;
          key: string;
          title: string;
          priority: number;
          content: string;
          tokenEstimate: number;
        }> = [];

        // Always include must-haves first
        for (const entry of mustInclude) {
          const charLen = entry.content.length;
          const tokenEst = Math.ceil(charLen / CHARS_PER_TOKEN);
          selected.push({
            type: entry.type,
            id: entry.id,
            key: entry.key,
            title: entry.title,
            priority: entry.priority,
            content: entry.content,
            tokenEstimate: tokenEst,
          });
          budgetRemaining -= charLen;
        }

        // Fill remaining budget with highest-priority candidates
        for (const entry of candidates) {
          const charLen = entry.content.length;
          if (charLen > budgetRemaining) continue;

          const tokenEst = Math.ceil(charLen / CHARS_PER_TOKEN);
          selected.push({
            type: entry.type,
            id: entry.id,
            key: entry.key,
            title: entry.title,
            priority: entry.priority,
            content: entry.content,
            tokenEstimate: tokenEst,
          });
          budgetRemaining -= charLen;

          if (budgetRemaining <= 0) break;
        }

        const totalTokens = selected.reduce((sum, e) => sum + e.tokenEstimate, 0);

        return textResponse(
          JSON.stringify(
            {
              budgetUsed: totalTokens,
              budgetMax: maxTokens,
              entriesIncluded: selected.length,
              entriesTotal: entries.length,
              entries: selected,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error retrieving context budget", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DEDUP CHECK (standalone tool)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_check_duplicates",
    "Check if content is similar to existing memories before storing. Returns near-duplicates based on word overlap similarity.",
    {
      content: z.string().min(1).describe("Content to check for duplicates"),
      excludeKey: z
        .string()
        .optional()
        .describe("Exclude this key from comparison (useful when updating)"),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .default(0.6)
        .describe("Similarity threshold (0-1, default 0.6)"),
    },
    async ({ content, excludeKey, threshold }) => {
      try {
        const result = await client.findSimilar(content, excludeKey, threshold);

        if (result.similar.length === 0) {
          return textResponse("No duplicates found. Content is unique.");
        }

        return textResponse(
          JSON.stringify(
            {
              warning: `Found ${result.similar.length} similar memories. Consider updating an existing one instead of creating a new entry.`,
              similar: result.similar,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error checking for duplicates", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY PIN / UNPIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_pin",
    "Pin or unpin a memory. Pinned memories are always included in bootstrap and context_budget, and never suggested for cleanup.",
    {
      key: z.string().describe("Key of the memory to pin/unpin"),
      pin: z.boolean().describe("true to pin, false to unpin"),
    },
    async ({ key, pin }) => {
      try {
        const result = await client.pinMemory(key, pin);
        return textResponse(result.message);
      } catch (error) {
        return errorResponse("Error pinning memory", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY LINK / RELATIONSHIPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_link",
    "Create or remove a bidirectional relationship between two memories. When loading one, related entries are suggested.",
    {
      key: z.string().describe("First memory key"),
      relatedKey: z.string().describe("Second memory key to link/unlink"),
      unlink: z.boolean().default(false).describe("true to remove the link"),
    },
    async ({ key, relatedKey, unlink }) => {
      try {
        const result = await client.linkMemories(key, relatedKey, unlink);
        return textResponse(
          `Memories ${unlink ? "unlinked" : "linked"}: "${key}" ↔ "${relatedKey}"`,
        );
      } catch (error) {
        return errorResponse("Error linking memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY DIFF
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_diff",
    "Show a readable line-by-line diff between two versions of a memory. If v2 is omitted, diffs version v1 against the current content.",
    {
      key: z.string().describe("Memory key"),
      v1: z.number().int().min(1).describe("First version number"),
      v2: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Second version number (omit to diff against current)"),
    },
    async ({ key, v1, v2 }) => {
      try {
        const result = await client.diffMemory(key, v1, v2);
        const diffText = result.diff
          .map((line) => {
            if (line.type === "add") return `+ ${line.line}`;
            if (line.type === "remove") return `- ${line.line}`;
            return `  ${line.line}`;
          })
          .join("\n");

        return textResponse(
          `Diff for "${key}" (${result.from} → ${result.to}):\n` +
            `+${result.summary.added} -${result.summary.removed} ~${result.summary.unchanged}\n\n` +
            diffText,
        );
      } catch (error) {
        return errorResponse("Error computing diff", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IMPORT .cursorrules / copilot-instructions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "import_cursorrules",
    "Import a .cursorrules or .github/copilot-instructions.md file into structured agent context. Parses the content the same way as agents_md_import.",
    {
      content: z.string().min(1).describe("Full text content of the .cursorrules or copilot-instructions.md file"),
      source: z
        .enum(["cursorrules", "copilot"])
        .default("cursorrules")
        .describe("Source format for metadata tagging"),
      dryRun: z
        .boolean()
        .default(false)
        .describe("If true, returns parsed sections without storing"),
      overwrite: z
        .boolean()
        .default(false)
        .describe("If true, overwrite existing entries"),
    },
    async ({ content, source, dryRun, overwrite }) => {
      try {
        const sections = parseAgentsMd(content);

        if (dryRun) {
          return textResponse(
            JSON.stringify(
              {
                dryRun: true,
                source,
                sections: sections.map((s) => ({
                  type: s.type,
                  id: s.id,
                  title: s.title,
                  contentLength: s.content.length,
                  key: buildAgentContextKey(s.type, s.id),
                })),
                totalSections: sections.length,
              },
              null,
              2,
            ),
          );
        }

        const results: Array<{ key: string; status: string }> = [];
        for (const section of sections) {
          const key = buildAgentContextKey(section.type, section.id);

          if (!overwrite) {
            try {
              await client.getMemory(key);
              results.push({ key, status: "skipped (exists)" });
              continue;
            } catch {}
          }

          try {
            await client.storeMemory(key, section.content, {
              scope: "agent_functionality",
              type: section.type,
              id: normalizeAgentContextId(section.id),
              title: section.title,
              importedFrom: source,
              updatedByTool: "import_cursorrules",
              updatedAt: new Date().toISOString(),
            });
            results.push({ key, status: "imported" });
          } catch (error) {
            results.push({
              key,
              status: `error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        return textResponse(
          JSON.stringify(
            {
              source,
              imported: results.filter((r) => r.status === "imported").length,
              skipped: results.filter((r) => r.status.startsWith("skipped")).length,
              errors: results.filter((r) => r.status.startsWith("error")).length,
              details: results,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse(`Error importing ${source}`, error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EXPORT — generate AGENTS.md / .cursorrules from memory
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "export_agents_md",
    "Export structured agent context memories back to AGENTS.md or .cursorrules format. Useful for keeping flat files in sync with memctl.",
    {
      format: z
        .enum(["agents_md", "cursorrules", "json"])
        .default("agents_md")
        .describe("Output format"),
    },
    async ({ format }) => {
      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);
        const allTypeInfo = await getAllContextTypeInfo(client);

        // Group by type
        const byType: Record<string, typeof entries> = {};
        for (const entry of entries) {
          if (entry.type === "branch_plan") continue;
          if (!byType[entry.type]) byType[entry.type] = [];
          byType[entry.type].push(entry);
        }

        if (format === "json") {
          return textResponse(JSON.stringify({ types: byType }, null, 2));
        }

        const lines: string[] = [];

        if (format === "agents_md") {
          lines.push("# AGENTS.md");
          lines.push("");
          lines.push("> Auto-generated from memctl structured agent context");
          lines.push("");
        }

        for (const [type, typeEntries] of Object.entries(byType)) {
          const label = allTypeInfo[type]?.label ?? type;

          if (format === "agents_md") {
            lines.push(`## ${label}`);
            lines.push("");
            for (const entry of typeEntries) {
              if (typeEntries.length > 1) {
                lines.push(`### ${entry.title}`);
                lines.push("");
              }
              lines.push(entry.content);
              lines.push("");
            }
          } else {
            // cursorrules: flat format
            lines.push(`# ${label}`);
            lines.push("");
            for (const entry of typeEntries) {
              lines.push(entry.content);
              lines.push("");
            }
          }
        }

        return textResponse(lines.join("\n"));
      } catch (error) {
        return errorResponse("Error exporting context", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMART COMPOSE — task-intent context retrieval
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "compose_context",
    "Intelligently compose context for a specific task. Analyzes the task description and selects the most relevant entries across all context types. Better than context_budget for task-specific retrieval.",
    {
      task: z
        .string()
        .min(1)
        .describe("Description of the task you're about to perform (e.g., 'add a REST endpoint for user preferences')"),
      maxTokens: z
        .number()
        .int()
        .min(100)
        .max(200000)
        .default(8000)
        .describe("Maximum token budget"),
      includeRelated: z
        .boolean()
        .default(true)
        .describe("Follow memory links to include related entries"),
    },
    async ({ task, maxTokens, includeRelated }) => {
      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);

        // Extract task keywords
        const taskWords = new Set(
          task
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2),
        );

        // Score each entry by relevance to the task
        const scored = entries.map((entry) => {
          const searchableText = `${entry.type} ${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
          let score = 0;

          // Pinned entries get a massive boost
          const mem = allMemories.find((m) => m.key === entry.key);
          if (mem && mem.pinnedAt) score += 200;

          // Priority contributes
          score += entry.priority;

          // Word match scoring
          for (const word of taskWords) {
            if (searchableText.includes(word)) score += 15;
          }

          // Type relevance: constraints and lessons_learned always get a boost
          if (entry.type === "constraints") score += 30;
          if (entry.type === "lessons_learned") score += 20;
          if (entry.type === "coding_style") score += 10;

          return { entry, score, mem };
        });

        scored.sort((a, b) => b.score - a.score);

        const CHARS_PER_TOKEN = 4;
        let budgetRemaining = maxTokens * CHARS_PER_TOKEN;
        const selected: Array<{
          type: string;
          id: string;
          key: string;
          title: string;
          content: string;
          relevanceScore: number;
          isPinned: boolean;
        }> = [];
        const selectedKeys = new Set<string>();

        for (const { entry, score, mem } of scored) {
          if (entry.content.length > budgetRemaining) continue;
          if (selectedKeys.has(entry.key)) continue;

          selected.push({
            type: entry.type,
            id: entry.id,
            key: entry.key,
            title: entry.title,
            content: entry.content,
            relevanceScore: score,
            isPinned: Boolean(mem?.pinnedAt),
          });
          selectedKeys.add(entry.key);
          budgetRemaining -= entry.content.length;

          // Follow links if enabled
          if (includeRelated && mem?.relatedKeys) {
            try {
              const relKeys = JSON.parse(typeof mem.relatedKeys === "string" ? mem.relatedKeys : "[]") as string[];
              for (const rk of relKeys) {
                if (selectedKeys.has(rk)) continue;
                const relEntry = entries.find((e) => e.key === rk);
                if (!relEntry || relEntry.content.length > budgetRemaining) continue;
                selected.push({
                  type: relEntry.type,
                  id: relEntry.id,
                  key: relEntry.key,
                  title: relEntry.title,
                  content: relEntry.content,
                  relevanceScore: score * 0.5,
                  isPinned: false,
                });
                selectedKeys.add(rk);
                budgetRemaining -= relEntry.content.length;
              }
            } catch {}
          }

          if (budgetRemaining <= 0) break;
        }

        const totalTokens = selected.reduce(
          (sum, e) => sum + Math.ceil(e.content.length / CHARS_PER_TOKEN),
          0,
        );

        return textResponse(
          JSON.stringify(
            {
              task,
              tokensUsed: totalTokens,
              tokenBudget: maxTokens,
              entriesSelected: selected.length,
              entries: selected,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error composing context", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONDITIONAL CONTEXT RULES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "context_rules_evaluate",
    "Evaluate conditional context rules for the current situation. Returns only context entries whose conditions (file patterns, branch patterns) match the given inputs.",
    {
      filePaths: z
        .array(z.string())
        .optional()
        .describe("File paths being modified"),
      branch: z
        .string()
        .optional()
        .describe("Current branch name (auto-detected if omitted)"),
      taskType: z
        .string()
        .optional()
        .describe("Type of task (e.g., 'api', 'frontend', 'testing', 'refactor')"),
    },
    async ({ filePaths, branch, taskType }) => {
      try {
        const branchInfo = await getBranchInfo();
        const currentBranch = branch ?? branchInfo?.branch ?? "";
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);

        const matched: Array<{
          type: string;
          id: string;
          title: string;
          content: string;
          matchedConditions: string[];
        }> = [];

        for (const entry of entries) {
          const conditions = entry.metadata?.conditions;
          if (!conditions || typeof conditions !== "object") continue;

          const cond = conditions as {
            filePatterns?: string[];
            branchPatterns?: string[];
            taskTypes?: string[];
          };

          const matchedConditions: string[] = [];

          // Check file patterns
          if (cond.filePatterns && filePaths) {
            for (const pattern of cond.filePatterns) {
              if (filePaths.some((fp) => matchGlob(fp, pattern))) {
                matchedConditions.push(`file:${pattern}`);
              }
            }
          }

          // Check branch patterns
          if (cond.branchPatterns && currentBranch) {
            for (const pattern of cond.branchPatterns) {
              if (matchGlob(currentBranch, pattern)) {
                matchedConditions.push(`branch:${pattern}`);
              }
            }
          }

          // Check task types
          if (cond.taskTypes && taskType) {
            if (cond.taskTypes.includes(taskType)) {
              matchedConditions.push(`task:${taskType}`);
            }
          }

          if (matchedConditions.length > 0) {
            matched.push({
              type: entry.type,
              id: entry.id,
              title: entry.title,
              content: entry.content,
              matchedConditions,
            });
          }
        }

        if (matched.length === 0) {
          return textResponse(
            "No conditional context rules matched the current situation.",
          );
        }

        return textResponse(
          JSON.stringify(
            {
              currentBranch,
              filePaths: filePaths ?? [],
              taskType: taskType ?? null,
              matchedRules: matched,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error evaluating context rules", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REPO SCAN STALENESS CHECK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "repo_scan_check",
    "Check if the stored file_map is stale compared to the current repository. Reports new/deleted files since the last scan.",
    {},
    async () => {
      try {
        // Get current repo files
        const result = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });
        const currentFiles = new Set(result.stdout.trim().split("\n").filter(Boolean));

        // Get stored file_map
        const key = buildAgentContextKey("file_map", "auto-scan");
        let storedMap: { totalFiles?: number; directories?: Array<{ files?: string[] }> } | null = null;

        try {
          const mem = await client.getMemory(key) as { memory?: { content?: string; updatedAt?: unknown } };
          if (mem?.memory?.content) {
            storedMap = JSON.parse(mem.memory.content);
          }
        } catch {
          return textResponse(
            "No stored file_map found. Run scan_repository first to create one.",
          );
        }

        // Reconstruct stored file set
        const storedFiles = new Set<string>();
        if (storedMap?.directories) {
          for (const dir of storedMap.directories) {
            if (dir.files) {
              for (const f of dir.files) storedFiles.add(f);
            }
          }
        }

        const newFiles = [...currentFiles].filter((f) => !storedFiles.has(f));
        const deletedFiles = [...storedFiles].filter((f) => !currentFiles.has(f));

        const isStale = newFiles.length > 0 || deletedFiles.length > 0;

        return textResponse(
          JSON.stringify(
            {
              isStale,
              currentFileCount: currentFiles.size,
              storedFileCount: storedFiles.size,
              newFiles: newFiles.slice(0, 50),
              deletedFiles: deletedFiles.slice(0, 50),
              newFilesTotal: newFiles.length,
              deletedFilesTotal: deletedFiles.length,
              recommendation: isStale
                ? "Run scan_repository with saveAsContext=true to update the file_map."
                : "File map is up to date.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error checking repo scan staleness", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY TEMPLATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_template",
    "Get a structured template for a given context type. Helps maintain consistent entries.",
    {
      type: z.string().describe("Context type to get template for"),
    },
    async ({ type }) => {
      const templates: Record<string, { description: string; template: string }> = {
        coding_style: {
          description: "Coding conventions and style guide",
          template: `## Language & Framework
- Primary language:
- Framework:

## Naming Conventions
- Variables:
- Functions:
- Components:
- Files:

## Formatting
- Indentation:
- Line length:
- Import ordering:

## Patterns to Follow
-

## Anti-patterns to Avoid
-`,
        },
        architecture: {
          description: "System architecture and design decisions",
          template: `## Overview
Brief description of the system architecture.

## Module Boundaries
-

## Data Flow
-

## Key Design Decisions
- Decision:
  - Context:
  - Trade-offs:

## Dependencies
-`,
        },
        testing: {
          description: "Testing strategy and requirements",
          template: `## Test Framework
-

## Required Coverage
-

## Test Locations
- Unit tests:
- Integration tests:
- E2E tests:

## Running Tests
\`\`\`bash
\`\`\`

## Testing Conventions
-`,
        },
        constraints: {
          description: "Hard rules and safety limits",
          template: `## Must Do
-

## Must Not Do
-

## Security Requirements
-

## Performance Requirements
-

## Backwards Compatibility
-`,
        },
        lessons_learned: {
          description: "Pitfalls and negative knowledge",
          template: `## What Happened
Describe the issue or failure.

## Why It Failed
Root cause analysis.

## What to Do Instead
The correct approach.

## Files/Areas Affected
-

## Date Discovered
`,
        },
        workflow: {
          description: "Development workflow and processes",
          template: `## Branching Strategy
-

## PR Process
-

## Deployment
-

## Code Review
-

## CI/CD
-`,
        },
        folder_structure: {
          description: "Repository organization",
          template: `## Root Layout
\`\`\`
/
├── src/
├── tests/
└── ...
\`\`\`

## Key Directories
-

## Where to Put New Code
-`,
        },
        file_map: {
          description: "Key file locations",
          template: `## Entry Points
-

## Configuration Files
-

## API Endpoints
-

## Database
-

## Shared Utilities
-`,
        },
      };

      const tmpl = templates[type];
      if (!tmpl) {
        const allTypeInfo = await getAllContextTypeInfo(client);
        const info = allTypeInfo[type];
        if (info) {
          return textResponse(
            JSON.stringify(
              {
                type,
                label: info.label,
                description: info.description,
                template: `## ${info.label}\n\n${info.description}\n\n## Content\n-`,
                note: "This is a custom type with a generic template. Fill in the details.",
              },
              null,
              2,
            ),
          );
        }
        return errorResponse(
          "Error getting template",
          `Unknown type "${type}". Use context_type_list to see available types.`,
        );
      }

      return textResponse(
        JSON.stringify(
          {
            type,
            description: tmpl.description,
            template: tmpl.template,
            usage: `Use agent_functionality_set with type="${type}" and the filled-in template as content.`,
          },
          null,
          2,
        ),
      );
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACTIVITY LOG
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "activity_log",
    "View recent agent activity for this project (opt-in). Shows tool calls, memory reads/writes, and session history.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Maximum entries to return"),
      sessionId: z
        .string()
        .optional()
        .describe("Filter by specific session ID"),
    },
    async ({ limit, sessionId }) => {
      try {
        const result = await client.getActivityLogs(limit, sessionId);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error retrieving activity logs", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GIT HOOKS GENERATOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "generate_git_hooks",
    "Generate git hook scripts that auto-inject memctl context checks. Returns the hook script content for the user to install. Does NOT install hooks automatically.",
    {
      hooks: z
        .array(z.enum(["pre-commit", "post-checkout", "prepare-commit-msg"]))
        .min(1)
        .describe("Which hooks to generate"),
    },
    async ({ hooks }) => {
      try {
        const scripts: Record<string, string> = {};

        if (hooks.includes("pre-commit")) {
          scripts["pre-commit"] = `#!/bin/sh
# memctl pre-commit hook
# Checks modified files against agent context constraints
#
# Install: cp this file to .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

CHANGED_FILES=$(git diff --cached --name-only)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

echo "[memctl] Checking agent context for modified files..."

# You can customize this to call the memctl CLI or API
# Example with curl:
# curl -s -X POST \\
#   -H "Authorization: Bearer $MEMCTL_TOKEN" \\
#   -H "X-Org-Slug: $MEMCTL_ORG" \\
#   -H "X-Project-Slug: $MEMCTL_PROJECT" \\
#   -H "Content-Type: application/json" \\
#   -d "{\\"filePaths\\": [$(echo "$CHANGED_FILES" | sed 's/.*/"&"/' | tr '\\n' ',' | sed 's/,$//')]]}" \\
#   "$MEMCTL_URL/api/v1/memories/watch"

echo "[memctl] Context check complete."
exit 0
`;
        }

        if (hooks.includes("post-checkout")) {
          scripts["post-checkout"] = `#!/bin/sh
# memctl post-checkout hook
# Loads branch context after switching branches
#
# Install: cp this file to .git/hooks/post-checkout && chmod +x .git/hooks/post-checkout

PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_CHECKOUT=$3

if [ "$BRANCH_CHECKOUT" != "1" ]; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "[memctl] Switched to branch: $BRANCH"
echo "[memctl] Run 'branch_context_get' in your agent to load the branch plan."

exit 0
`;
        }

        if (hooks.includes("prepare-commit-msg")) {
          scripts["prepare-commit-msg"] = `#!/bin/sh
# memctl prepare-commit-msg hook
# Adds context reminder to commit message template
#
# Install: cp this file to .git/hooks/prepare-commit-msg && chmod +x .git/hooks/prepare-commit-msg

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only add for regular commits (not merge/squash)
if [ -z "$COMMIT_SOURCE" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "" >> "$COMMIT_MSG_FILE"
  echo "# [memctl] Branch: $BRANCH" >> "$COMMIT_MSG_FILE"
  echo "# Run 'session_end' after committing to save session context." >> "$COMMIT_MSG_FILE"
fi

exit 0
`;
        }

        return textResponse(
          JSON.stringify(
            {
              hooks: Object.keys(scripts),
              scripts,
              installation: "Save each script to .git/hooks/<name> and run chmod +x on it.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error generating git hooks", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BATCH MUTATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_batch_mutate",
    "Perform a single action on multiple memories at once. Supports: archive, unarchive, delete, pin, unpin, set_priority, add_tags, set_scope.",
    {
      keys: z
        .array(z.string())
        .min(1)
        .max(100)
        .describe("Memory keys to mutate"),
      action: z
        .enum([
          "archive",
          "unarchive",
          "delete",
          "pin",
          "unpin",
          "set_priority",
          "add_tags",
          "set_scope",
        ])
        .describe("Action to perform"),
      value: z
        .unknown()
        .optional()
        .describe("Value for the action (number for set_priority, string[] for add_tags, 'project'|'shared' for set_scope)"),
    },
    async ({ keys, action, value }) => {
      try {
        const result = await client.batchMutate(keys, action, value);
        return textResponse(
          `Batch ${action}: ${result.affected}/${result.matched} memories affected (${result.requested} requested).`,
        );
      } catch (error) {
        return errorResponse("Error in batch mutation", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY SNAPSHOTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_snapshot_create",
    "Create a full point-in-time snapshot of all memories. Useful before big refactors or context updates.",
    {
      name: z.string().min(1).max(128).describe("Snapshot name (e.g., 'before-api-refactor')"),
      description: z.string().max(512).optional().describe("Optional description"),
    },
    async ({ name, description }) => {
      try {
        const result = await client.createSnapshot(name, description);
        return textResponse(
          `Snapshot "${name}" created with ${result.snapshot.memoryCount} memories. ID: ${result.snapshot.id}`,
        );
      } catch (error) {
        return errorResponse("Error creating snapshot", error);
      }
    },
  );

  server.tool(
    "memory_snapshot_list",
    "List available memory snapshots for the current project",
    {
      limit: z.number().int().min(1).max(50).default(10).describe("Maximum snapshots to return"),
    },
    async ({ limit }) => {
      try {
        const result = await client.listSnapshots(limit);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error listing snapshots", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY FEEDBACK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_feedback",
    "Rate a memory as helpful or unhelpful. Feedback influences automatic priority adjustments via lifecycle policies.",
    {
      key: z.string().describe("Memory key to rate"),
      helpful: z.boolean().describe("true = helpful, false = unhelpful"),
    },
    async ({ key, helpful }) => {
      try {
        const result = await client.feedbackMemory(key, helpful);
        return textResponse(
          `Feedback recorded for "${key}": ${result.feedback} (${result.helpfulCount} helpful, ${result.unhelpfulCount} unhelpful)`,
        );
      } catch (error) {
        return errorResponse("Error recording feedback", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIFECYCLE POLICIES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "lifecycle_run",
    "Run automatic lifecycle policies to manage memory health. Policies: archive_merged_branches, cleanup_expired, cleanup_session_logs, auto_promote (boost frequently accessed), auto_demote (lower negatively rated).",
    {
      policies: z
        .array(
          z.enum([
            "archive_merged_branches",
            "cleanup_expired",
            "cleanup_session_logs",
            "auto_promote",
            "auto_demote",
          ]),
        )
        .min(1)
        .describe("Policies to run"),
      mergedBranches: z
        .array(z.string())
        .optional()
        .describe("Branch names that have been merged (for archive_merged_branches)"),
      sessionLogMaxAgeDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .default(30)
        .describe("Max age for session logs before cleanup"),
    },
    async ({ policies, mergedBranches, sessionLogMaxAgeDays }) => {
      try {
        const result = await client.runLifecycle(policies, {
          mergedBranches,
          sessionLogMaxAgeDays,
        });

        const summary = Object.entries(result.results)
          .map(([policy, r]) => `${policy}: ${r.affected} affected${r.details ? ` (${r.details})` : ""}`)
          .join("\n");

        return textResponse(`Lifecycle policies executed:\n${summary}`);
      } catch (error) {
        return errorResponse("Error running lifecycle policies", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CROSS-REFERENCE VALIDATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "validate_references",
    "Check if memories reference files or paths that no longer exist in the repository. Scans the repo and cross-references against memory content.",
    {},
    async () => {
      try {
        // Get current repo files
        const result = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });
        const repoFiles = result.stdout.trim().split("\n").filter(Boolean);

        const validation = await client.validateReferences(repoFiles);

        if (validation.issuesFound === 0) {
          return textResponse(
            `All references valid. Checked ${validation.totalMemoriesChecked} memories against ${repoFiles.length} repo files.`,
          );
        }

        return textResponse(
          JSON.stringify(
            {
              summary: `Found ${validation.issuesFound} memories with stale file references.`,
              ...validation,
              actions: "Update or archive memories that reference deleted files.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error validating references", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONFLICT DETECTION ON WRITE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_store_safe",
    "Store a memory with optimistic concurrency check. If the memory was modified since you last read it (ifUnmodifiedSince), returns a conflict with the diff instead of blindly overwriting.",
    {
      key: z.string().describe("Memory key"),
      content: z.string().describe("New content"),
      ifUnmodifiedSince: z
        .number()
        .describe("Unix timestamp (ms) of when you last read this memory. If it was modified after this, a conflict is returned."),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
      priority: z.number().int().min(0).max(100).optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ key, content, ifUnmodifiedSince, metadata, priority, tags }) => {
      try {
        // Check current state
        let current: Record<string, unknown> | null = null;
        try {
          current = await client.getMemory(key) as Record<string, unknown>;
        } catch {
          // Memory doesn't exist, safe to create
        }

        const mem = current?.memory as Record<string, unknown> | undefined;
        if (mem?.updatedAt) {
          const currentUpdated = typeof mem.updatedAt === "string"
            ? new Date(mem.updatedAt).getTime()
            : typeof mem.updatedAt === "number"
              ? mem.updatedAt
              : 0;

          if (currentUpdated > ifUnmodifiedSince) {
            const memContent = typeof mem.content === "string" ? mem.content : "";
            // Conflict detected
            return textResponse(
              JSON.stringify(
                {
                  conflict: true,
                  key,
                  message: "Memory was modified since you last read it.",
                  yourVersion: content.slice(0, 500),
                  currentVersion: memContent.slice(0, 500),
                  currentUpdatedAt: mem.updatedAt,
                  yourTimestamp: new Date(ifUnmodifiedSince).toISOString(),
                  suggestion: "Read the current version, merge changes, then store again without ifUnmodifiedSince.",
                },
                null,
                2,
              ),
            );
          }
        }

        // No conflict, proceed with store
        await client.storeMemory(key, content, metadata, { priority, tags });
        return textResponse(`Memory stored with key: ${key} (no conflict)`);
      } catch (error) {
        return errorResponse("Error in safe store", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPACT BOOTSTRAP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_bootstrap_compact",
    "Lightweight bootstrap that returns only titles, keys, and metadata (no content). Useful for initial orientation when you have many context entries. Fetch specific entries with agent_functionality_get afterward.",
    {},
    async () => {
      try {
        const [allMemories, branchInfo, capacity, allTypeInfo] = await Promise.all([
          listAllMemories(client),
          getBranchInfo(),
          client.getMemoryCapacity().catch(() => null),
          getAllContextTypeInfo(client),
        ]);

        const entries = extractAgentContextEntries(allMemories);

        const types = Object.entries(allTypeInfo).map(([type, info]) => {
          const typeEntries = entries.filter((e) => e.type === type);
          return {
            type,
            label: info.label,
            count: typeEntries.length,
            items: typeEntries.map((entry) => {
              const mem = allMemories.find((m) => m.key === entry.key);
              return {
                id: entry.id,
                key: entry.key,
                title: entry.title,
                priority: entry.priority,
                isPinned: Boolean(mem?.pinnedAt),
                scope: mem?.scope ?? "project",
                tags: entry.tags,
                contentLength: entry.content.length,
                feedbackScore: (mem?.helpfulCount ?? 0) - (mem?.unhelpfulCount ?? 0),
              };
            }),
          };
        });

        return textResponse(
          JSON.stringify(
            {
              mode: "compact",
              hint: "Use agent_functionality_get to load full content for specific entries.",
              types: types.filter((t) => t.count > 0),
              currentBranch: branchInfo,
              memoryStatus: capacity,
              totalEntries: entries.length,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error in compact bootstrap", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AUTO-TAGGING (heuristic, no AI)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_auto_tag",
    "Analyze a memory's content and suggest tags based on keyword extraction. Uses heuristic pattern matching, not AI.",
    {
      key: z.string().describe("Memory key to analyze"),
      apply: z
        .boolean()
        .default(false)
        .describe("If true, apply the suggested tags to the memory"),
    },
    async ({ key, apply }) => {
      try {
        const mem = await client.getMemory(key) as {
          memory?: { content?: string; tags?: string; key?: string };
        };
        if (!mem?.memory?.content) {
          return errorResponse("Error auto-tagging", "Memory not found or empty");
        }

        const content = mem.memory.content.toLowerCase();
        const suggestedTags: string[] = [];

        // Technology detection
        const techPatterns: Record<string, string[]> = {
          react: ["react", "jsx", "tsx", "usestate", "useeffect", "component"],
          nextjs: ["next.js", "nextjs", "app router", "getserversideprops", "server component"],
          typescript: ["typescript", ".ts", ".tsx", "interface ", "type "],
          javascript: ["javascript", ".js", ".mjs", "const ", "let "],
          python: ["python", ".py", "def ", "import ", "pip"],
          rust: ["rust", ".rs", "cargo", "fn ", "impl "],
          go: ["golang", ".go", "func ", "package "],
          css: ["css", "tailwind", "styled", "scss", "sass"],
          database: ["database", "sql", "query", "schema", "migration", "drizzle", "prisma"],
          api: ["api", "endpoint", "rest", "graphql", "route", "handler"],
          testing: ["test", "jest", "vitest", "playwright", "cypress", "assert"],
          docker: ["docker", "container", "dockerfile", "compose"],
          ci: ["ci/cd", "github actions", "pipeline", "deploy"],
          auth: ["auth", "login", "session", "token", "jwt", "oauth"],
          security: ["security", "xss", "csrf", "injection", "sanitize"],
        };

        for (const [tag, keywords] of Object.entries(techPatterns)) {
          if (keywords.some((kw) => content.includes(kw))) {
            suggestedTags.push(tag);
          }
        }

        // Scope detection
        if (content.includes("frontend") || content.includes("ui") || content.includes("component")) {
          suggestedTags.push("frontend");
        }
        if (content.includes("backend") || content.includes("server") || content.includes("api")) {
          suggestedTags.push("backend");
        }
        if (content.includes("performance") || content.includes("optimize") || content.includes("cache")) {
          suggestedTags.push("performance");
        }

        // Deduplicate
        const uniqueTags = [...new Set(suggestedTags)];

        if (apply && uniqueTags.length > 0) {
          // Merge with existing tags
          let existingTags: string[] = [];
          if (mem.memory.tags) {
            try { existingTags = JSON.parse(mem.memory.tags); } catch {}
          }
          const merged = [...new Set([...existingTags, ...uniqueTags])];
          await client.updateMemory(key, undefined, undefined, {
            tags: merged,
          });
          return textResponse(
            `Auto-tagged "${key}" with: ${uniqueTags.join(", ")}. Total tags: ${merged.join(", ")}`,
          );
        }

        return textResponse(
          JSON.stringify(
            {
              key,
              suggestedTags: uniqueTags,
              applied: false,
              hint: "Call again with apply=true to apply these tags.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error auto-tagging memory", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STALE REFERENCE PRUNING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "prune_stale_references",
    "Find and optionally archive memories that reference files no longer in the repository. Combines repo scanning with content analysis.",
    {
      archiveStale: z
        .boolean()
        .default(false)
        .describe("If true, archive memories with stale references"),
    },
    async ({ archiveStale }) => {
      try {
        const result = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });
        const repoFiles = result.stdout.trim().split("\n").filter(Boolean);

        const validation = await client.validateReferences(repoFiles);

        if (validation.issuesFound === 0) {
          return textResponse("No stale references found. All memories are up to date.");
        }

        if (archiveStale) {
          const staleKeys = validation.issues.map((i) => i.key);
          const batchResult = await client.batchMutate(staleKeys, "archive");
          return textResponse(
            `Archived ${batchResult.affected} memories with stale file references.`,
          );
        }

        return textResponse(
          JSON.stringify(
            {
              summary: `${validation.issuesFound} memories reference files that no longer exist.`,
              issues: validation.issues,
              hint: "Call again with archiveStale=true to archive these memories.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error pruning stale references", error);
      }
    },
  );
}
