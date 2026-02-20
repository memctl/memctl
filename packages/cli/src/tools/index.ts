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
  getCustomContextTypes,
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
  // SESSION RATE LIMITING (Feature 8)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const RATE_LIMIT = Number(process.env.MEMCTL_RATE_LIMIT) || 500;
  let writeCallCount = 0;

  function checkRateLimit(): { allowed: boolean; warning?: string } {
    const pct = writeCallCount / RATE_LIMIT;
    if (pct >= 1) {
      return {
        allowed: false,
        warning: `Rate limit reached (${writeCallCount}/${RATE_LIMIT}). No more write operations allowed this session.`,
      };
    }
    if (pct >= 0.8) {
      return {
        allowed: true,
        warning: `Approaching rate limit: ${writeCallCount}/${RATE_LIMIT} write calls used (${Math.round(pct * 100)}%).`,
      };
    }
    return { allowed: true };
  }

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
      branch: z
        .string()
        .optional()
        .describe("Filter by branch tag. Branch-tagged memories sort first, global memories still included."),
    },
    async ({ includeContent, types, branch }) => {
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

        // Resolve branch filter
        const branchFilter = branch ?? (branchInfo?.branch && branchInfo.branch !== "main" && branchInfo.branch !== "master" ? branchInfo.branch : null);
        const branchTag = branchFilter ? `branch:${branchFilter}` : null;

        // Group entries by type, sorting branch-tagged first
        const functionalityTypes = selectedTypes.map((type) => {
          const typeInfo = allTypeInfo[type];
          let typeEntries = entries.filter((e) => e.type === type);

          // Sort branch-tagged memories first when branch filter is active
          if (branchTag) {
            typeEntries = typeEntries.sort((a, b) => {
              const aHasBranch = a.tags.includes(branchTag!) ? 1 : 0;
              const bHasBranch = b.tags.includes(branchTag!) ? 1 : 0;
              if (aHasBranch !== bHasBranch) return bHasBranch - aHasBranch;
              return b.priority - a.priority;
            });
          }

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

        // Hint about org defaults when project is empty (Feature 6)
        const totalEntries = entries.length;
        let orgDefaultsHint: string | undefined;
        if (totalEntries === 0) {
          try {
            const orgDefaults = await client.listOrgDefaults();
            if (orgDefaults.defaults.length > 0) {
              orgDefaultsHint = `This project has no memories yet. Your organization has ${orgDefaults.defaults.length} default memories available. Use org_defaults_apply to populate this project.`;
            }
          } catch { /* ignore if org defaults API not available */ }
        }

        return textResponse(
          JSON.stringify(
            {
              functionalityTypes,
              currentBranch: branchInfo,
              branchPlan,
              memoryStatus,
              availableTypes: allTypeSlugs,
              orgDefaultsHint,
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
    "Store a key-value memory for the current project. Use scope='shared' to make it visible across all projects in the org (opt-in). Use ttl for named expiration presets. Auto-checks for duplicates and warns if similar content exists.",
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
        .describe("Unix timestamp when this memory should expire (overrides ttl)"),
      ttl: z
        .enum(["session", "pr", "sprint", "permanent"])
        .optional()
        .describe("Named TTL preset: session (24h), pr (7d), sprint (14d), permanent (never). Overridden by expiresAt if both set."),
      dedupAction: z
        .enum(["warn", "skip", "merge"])
        .optional()
        .default("warn")
        .describe("What to do if similar content exists: warn (store + warn), skip (don't store), merge (append to existing)"),
      autoBranch: z
        .boolean()
        .default(true)
        .describe("Auto-append branch:<name> tag when on a non-main/master branch"),
    },
    async ({ key, content, metadata, scope, priority, tags, expiresAt, ttl, dedupAction, autoBranch }) => {
      try {
        // Rate limit check
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }
        writeCallCount++;

        // Auto-branch tagging (Feature 1)
        let resolvedTags = tags ?? [];
        if (autoBranch) {
          try {
            const bi = await getBranchInfo();
            if (bi?.branch && bi.branch !== "main" && bi.branch !== "master") {
              const branchTag = `branch:${bi.branch}`;
              if (!resolvedTags.includes(branchTag)) {
                resolvedTags = [...resolvedTags, branchTag];
              }
            }
          } catch { /* ignore git errors */ }
        }

        // Resolve TTL preset to expiresAt
        let resolvedExpiry = expiresAt;
        if (!resolvedExpiry && ttl && ttl !== "permanent") {
          const now = Date.now();
          const TTL_MAP: Record<string, number> = {
            session: 24 * 60 * 60 * 1000,       // 24 hours
            pr: 7 * 24 * 60 * 60 * 1000,         // 7 days
            sprint: 14 * 24 * 60 * 60 * 1000,    // 14 days
          };
          resolvedExpiry = now + (TTL_MAP[ttl] ?? 0);
        }

        // Check for near-duplicates before storing
        let dedupWarning = "";
        const action = dedupAction ?? "warn";
        try {
          const similar = await client.findSimilar(content, key, 0.7);
          if (similar.similar.length > 0) {
            const top = similar.similar[0]!;

            if (action === "skip") {
              return textResponse(
                `Skipped: similar memory "${top.key}" already exists (${Math.round(top.similarity * 100)}% match). Use dedupAction='warn' to store anyway.`,
              );
            }

            if (action === "merge") {
              // Append to the existing similar memory
              const existing = await client.getMemory(top.key) as Record<string, unknown>;
              const existingMem = existing?.memory as Record<string, unknown> | undefined;
              const existingContent = typeof existingMem?.content === "string" ? existingMem.content : "";
              const merged = `${existingContent}\n\n---\n\n${content}`;
              await client.storeMemory(top.key, merged, metadata, { scope, priority, tags: resolvedTags.length > 0 ? resolvedTags : undefined, expiresAt: resolvedExpiry });
              return textResponse(
                `Merged into existing memory "${top.key}" (${Math.round(top.similarity * 100)}% match). Content appended.`,
              );
            }

            // Default: warn
            dedupWarning = ` ⚠ Similar memory: "${top.key}" (${Math.round(top.similarity * 100)}% match). Use dedupAction='merge' to combine, or 'skip' to cancel.`;
          }
        } catch {
          // Dedup check is best-effort
        }

        await client.storeMemory(key, content, metadata, { scope, priority, tags: resolvedTags.length > 0 ? resolvedTags : undefined, expiresAt: resolvedExpiry });
        const scopeMsg = scope === "shared" ? " [shared across org]" : "";
        const ttlMsg = ttl ? ` [ttl: ${ttl}]` : "";
        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
        return textResponse(`Memory stored with key: ${key}${scopeMsg}${ttlMsg}${dedupWarning}${rateWarn}`);
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
    "Retrieve a memory by key. Includes contextual hints about staleness, feedback, access patterns, and more.",
    {
      key: z.string().describe("Key of the memory to retrieve"),
      includeHints: z
        .boolean()
        .default(true)
        .describe("Include contextual hints (staleness, feedback ratio, etc.)"),
    },
    async ({ key, includeHints }) => {
      try {
        const memory = await client.getMemory(key) as { memory?: Record<string, unknown> };

        if (includeHints && memory?.memory) {
          const mem = memory.memory;
          const hints: string[] = [];
          const now = Date.now();

          // Staleness hint
          const updatedAt = mem.updatedAt ? new Date(mem.updatedAt as string).getTime() : 0;
          if (updatedAt) {
            const daysSinceUpdate = (now - updatedAt) / 86_400_000;
            if (daysSinceUpdate > 60) hints.push(`Stale: not updated in ${Math.round(daysSinceUpdate)} days`);
            else if (daysSinceUpdate > 30) hints.push(`Aging: last updated ${Math.round(daysSinceUpdate)} days ago`);
          }

          // Access recency hint
          const lastAccessed = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
          if (lastAccessed) {
            const daysSinceAccess = (now - lastAccessed) / 86_400_000;
            if (daysSinceAccess > 30) hints.push(`Rarely accessed: last read ${Math.round(daysSinceAccess)} days ago`);
          } else {
            hints.push("Never accessed before");
          }

          // Feedback ratio hint
          const helpful = (mem.helpfulCount as number) ?? 0;
          const unhelpful = (mem.unhelpfulCount as number) ?? 0;
          if (helpful + unhelpful > 0) {
            if (unhelpful > helpful) hints.push(`Negative feedback: ${helpful} helpful, ${unhelpful} unhelpful`);
            else if (helpful > 0) hints.push(`Positive feedback: ${helpful} helpful, ${unhelpful} unhelpful`);
          }

          // Pin status hint
          if (mem.pinnedAt) hints.push("Pinned: always included in bootstrap");

          // Expiry hint
          if (mem.expiresAt) {
            const expiresAt = new Date(mem.expiresAt as string).getTime();
            const daysUntilExpiry = (expiresAt - now) / 86_400_000;
            if (daysUntilExpiry < 0) hints.push("Expired");
            else if (daysUntilExpiry < 3) hints.push(`Expiring soon: ${Math.round(daysUntilExpiry * 24)} hours left`);
          }

          // Content size hint
          const contentLen = typeof mem.content === "string" ? mem.content.length : 0;
          if (contentLen > 8000) hints.push(`Large memory: ~${Math.ceil(contentLen / 4)} tokens`);

          // Link count hint
          if (mem.relatedKeys) {
            try {
              const relKeys = JSON.parse(mem.relatedKeys as string) as string[];
              if (relKeys.length > 0) hints.push(`Linked to ${relKeys.length} other memories`);
            } catch { /* ignore */ }
          }

          return textResponse(JSON.stringify({ ...memory, hints }, null, 2));
        }

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
        // Rate limit check
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }
        writeCallCount++;

        await client.deleteMemory(key);
        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
        return textResponse(`Memory deleted: ${key}${rateWarn}`);
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
        // Rate limit check
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }
        writeCallCount++;

        await client.updateMemory(key, content, metadata, { priority, tags });

        // Impact analysis warning (Feature 4)
        let impactWarning = "";
        try {
          const allMemories = await listAllMemories(client);
          const impacted = allMemories.filter((m) => {
            if (m.key === key) return false;
            const c = (m.content ?? "").toLowerCase();
            const rk = (m.relatedKeys ?? "").toLowerCase();
            const meta = typeof m.metadata === "string" ? m.metadata.toLowerCase() : "";
            const keyLower = key.toLowerCase();
            return c.includes(keyLower) || rk.includes(keyLower) || meta.includes(keyLower);
          });
          if (impacted.length > 0) {
            impactWarning = ` ⚠ ${impacted.length} other memories reference "${key}": ${impacted.slice(0, 5).map((m) => m.key).join(", ")}${impacted.length > 5 ? "..." : ""}. Use memory_impact to see details.`;
          }
        } catch { /* best-effort */ }

        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
        return textResponse(`Memory updated: ${key}${impactWarning}${rateWarn}`);
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
    "Get detailed functionality data for one type or one specific item. When followLinks is true, also returns linked/related memories.",
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
      followLinks: z
        .boolean()
        .default(false)
        .describe("Also include linked/related memories (follows relatedKeys)"),
    },
    async ({ type, id, includeContent, followLinks }) => {
      try {
        if (id) {
          const key = buildAgentContextKey(type, id);
          const memory = await client.getMemory(key) as Record<string, unknown>;

          // Follow related links if requested
          let linked: unknown[] = [];
          if (followLinks) {
            const mem = memory?.memory as Record<string, unknown> | undefined;
            const relatedKeysRaw = typeof mem?.relatedKeys === "string" ? mem.relatedKeys : null;
            if (relatedKeysRaw) {
              try {
                const relatedKeys = JSON.parse(relatedKeysRaw) as string[];
                if (relatedKeys.length > 0) {
                  const bulk = await client.bulkGetMemories(relatedKeys);
                  linked = Object.values(bulk.memories);
                }
              } catch { /* ignore parse errors */ }
            }
          }

          return textResponse(JSON.stringify(
            followLinks ? { ...memory, linkedMemories: linked } : memory,
            null,
            2,
          ));
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

        const CHARS_PER_TOKEN = 4;
        let budgetRemaining = maxTokens * CHARS_PER_TOKEN;
        const now = Date.now();

        // Compute value score for each candidate (relevance * priority / cost)
        const scored = candidates.map((entry) => {
          const charLen = entry.content.length;
          const tokenEst = Math.ceil(charLen / CHARS_PER_TOKEN);
          const mem = allMemories.find((m) => m.key === entry.key);
          const accessCount = mem?.accessCount ?? 0;
          const helpful = (mem?.helpfulCount ?? 0) - (mem?.unhelpfulCount ?? 0);
          const lastAccess = mem?.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
          const daysSinceAccess = lastAccess ? (now - lastAccess) / 86_400_000 : 999;
          const isPinned = mem?.pinnedAt ? 1 : 0;

          // Value = weighted combination of signals
          const priorityVal = entry.priority * 2;
          const accessVal = Math.min(20, accessCount * 2);
          const feedbackVal = Math.max(0, helpful * 3);
          const recencyVal = Math.max(0, 20 - daysSinceAccess / 3);
          const pinBoost = isPinned * 30;
          const totalValue = priorityVal + accessVal + feedbackVal + recencyVal + pinBoost;

          // Efficiency = value per token (knapsack: maximize value within budget)
          const efficiency = tokenEst > 0 ? totalValue / tokenEst : 0;

          return { entry, charLen, tokenEst, totalValue, efficiency };
        });

        // Sort by efficiency (value/token), breaking ties with total value
        scored.sort((a, b) => {
          if (Math.abs(b.efficiency - a.efficiency) > 0.01) return b.efficiency - a.efficiency;
          return b.totalValue - a.totalValue;
        });

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

        // Fill remaining budget using efficiency-sorted candidates (greedy knapsack)
        for (const { entry, charLen, tokenEst } of scored) {
          if (charLen > budgetRemaining) continue;

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
        // Rate limit check
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }
        writeCallCount++;

        const result = await client.batchMutate(keys, action, value);
        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
        return textResponse(
          `Batch ${action}: ${result.affected}/${result.matched} memories affected (${result.requested} requested).${rateWarn}`,
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
    "Store a memory with optimistic concurrency check and conflict resolution. If modified since ifUnmodifiedSince, uses the chosen strategy: 'reject' (default, return conflict), 'last_write_wins' (overwrite), 'append' (merge by appending), or 'return_both' (return both versions for manual merge).",
    {
      key: z.string().describe("Memory key"),
      content: z.string().describe("New content"),
      ifUnmodifiedSince: z
        .number()
        .describe("Unix timestamp (ms) of when you last read this memory. If it was modified after this, conflict resolution applies."),
      onConflict: z
        .enum(["reject", "last_write_wins", "append", "return_both"])
        .optional()
        .default("reject")
        .describe("Conflict resolution strategy: reject (return conflict), last_write_wins (overwrite), append (concatenate both), return_both (show both versions)"),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
      priority: z.number().int().min(0).max(100).optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ key, content, ifUnmodifiedSince, onConflict, metadata, priority, tags }) => {
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
            const strategy = onConflict ?? "reject";

            if (strategy === "last_write_wins") {
              await client.storeMemory(key, content, metadata, { priority, tags });
              return textResponse(`Memory stored with key: ${key} (conflict resolved: last_write_wins, overwrote remote changes)`);
            }

            if (strategy === "append") {
              const merged = `${memContent}\n\n---\n\n${content}`;
              await client.storeMemory(key, merged, metadata, { priority, tags });
              return textResponse(`Memory stored with key: ${key} (conflict resolved: append, merged both versions)`);
            }

            if (strategy === "return_both") {
              return textResponse(
                JSON.stringify(
                  {
                    conflict: true,
                    key,
                    strategy: "return_both",
                    message: "Memory was modified. Both versions returned for manual merge.",
                    remoteVersion: memContent,
                    localVersion: content,
                    remoteUpdatedAt: mem.updatedAt,
                    localTimestamp: new Date(ifUnmodifiedSince).toISOString(),
                    hint: "Merge the content yourself, then call memory_store (without _safe) to save the merged result.",
                  },
                  null,
                  2,
                ),
              );
            }

            // Default: reject
            return textResponse(
              JSON.stringify(
                {
                  conflict: true,
                  key,
                  strategy: "reject",
                  message: "Memory was modified since you last read it.",
                  yourVersion: content.slice(0, 500),
                  currentVersion: memContent.slice(0, 500),
                  currentUpdatedAt: mem.updatedAt,
                  yourTimestamp: new Date(ifUnmodifiedSince).toISOString(),
                  suggestion: "Read the current version, merge changes, then store again. Or use onConflict: 'last_write_wins' or 'append'.",
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELTA BOOTSTRAP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_bootstrap_delta",
    "Incremental sync: returns only memories that changed since a given timestamp. Use this at session start if you have a cached copy from a previous session. Much faster than full bootstrap for repeat sessions.",
    {
      since: z
        .number()
        .describe("Unix timestamp (ms) from your last sync. All changes after this are returned."),
    },
    async ({ since }) => {
      try {
        const delta = await client.getDelta(since);
        return textResponse(
          JSON.stringify(
            {
              created: delta.created.length,
              updated: delta.updated.length,
              deleted: delta.deleted.length,
              since: new Date(delta.since).toISOString(),
              now: new Date(delta.now).toISOString(),
              createdMemories: delta.created,
              updatedMemories: delta.updated,
              deletedKeys: delta.deleted,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error fetching delta", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY HEALTH SCORES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_health",
    "Get health scores for all memories. Score 0-100 based on age, access frequency, feedback, and recency. Sorted worst-first to prioritize maintenance on degraded entries.",
    {
      limit: z.number().int().min(1).max(200).optional().default(50),
    },
    async ({ limit }) => {
      try {
        const result = await client.getHealthScores(limit);
        const unhealthy = result.memories.filter((m) => m.healthScore < 40);
        return textResponse(
          JSON.stringify(
            {
              total: result.memories.length,
              unhealthyCount: unhealthy.length,
              memories: result.memories,
              hint: unhealthy.length > 0
                ? `${unhealthy.length} memories have health score below 40. Consider updating or archiving them.`
                : "All memories are in good health.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error fetching health scores", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY LOCKING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_lock",
    "Acquire a short-lived lock on a memory to prevent concurrent overwrites. Lock auto-expires after ttlSeconds (default 60s). Check 'acquired' in the response.",
    {
      key: z.string().describe("Memory key to lock"),
      lockedBy: z.string().optional().describe("Identifier for who is locking (e.g. session ID)"),
      ttlSeconds: z.number().int().min(5).max(600).optional().default(60).describe("Lock TTL in seconds (default 60, max 600)"),
    },
    async ({ key, lockedBy, ttlSeconds }) => {
      try {
        const result = await client.lockMemory(key, lockedBy, ttlSeconds);
        if (!result.acquired) {
          return textResponse(
            JSON.stringify(
              {
                acquired: false,
                key,
                message: "Lock held by another agent.",
                currentLock: result.lock,
                suggestion: "Wait for the lock to expire or try again later.",
              },
              null,
              2,
            ),
          );
        }
        return textResponse(
          JSON.stringify(
            {
              acquired: true,
              key,
              expiresAt: result.lock.expiresAt,
              message: `Lock acquired. Expires in ${ttlSeconds}s. Call memory_unlock when done.`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error acquiring lock", error);
      }
    },
  );

  server.tool(
    "memory_unlock",
    "Release a lock on a memory. Optionally provide lockedBy to only release your own lock.",
    {
      key: z.string().describe("Memory key to unlock"),
      lockedBy: z.string().optional().describe("Only release if this matches the lock holder"),
    },
    async ({ key, lockedBy }) => {
      try {
        const result = await client.unlockMemory(key, lockedBy);
        return textResponse(`Lock released for key: ${key} (released: ${result.released})`);
      } catch (error) {
        return errorResponse("Error releasing lock", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // USAGE ANALYTICS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_analytics",
    "Get usage analytics: most/least accessed memories, tag distribution, scope breakdown, access counts, and more. Useful for understanding how context is being used.",
    {},
    async () => {
      try {
        const analytics = await client.getAnalytics();
        return textResponse(JSON.stringify(analytics, null, 2));
      } catch (error) {
        return errorResponse("Error fetching analytics", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANGE DIGEST
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_change_digest",
    "Get a summary of what changed since a given timestamp. Returns counts by action type and a list of individual changes. Useful at session start to understand what happened since your last session.",
    {
      since: z
        .number()
        .describe("Unix timestamp (ms) — show changes after this point"),
      limit: z.number().int().min(1).max(500).optional().default(100),
    },
    async ({ since, limit }) => {
      try {
        const changes = await client.getChanges(since, limit);
        return textResponse(
          JSON.stringify(
            {
              timeRange: {
                from: new Date(changes.since).toISOString(),
                to: new Date(changes.until).toISOString(),
              },
              summary: changes.summary,
              changes: changes.changes,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error fetching change digest", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROJECT TEMPLATES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "project_template_list",
    "List available project templates. Templates pre-populate new projects with a starter memory structure (coding style, folder structure, testing conventions, etc).",
    {},
    async () => {
      try {
        const result = await client.listTemplates();
        return textResponse(
          JSON.stringify(
            {
              templates: result.templates.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                entryCount: Array.isArray(t.data) ? t.data.length : 0,
                isBuiltin: t.isBuiltin,
              })),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error listing templates", error);
      }
    },
  );

  server.tool(
    "project_template_apply",
    "Apply a project template to populate this project with starter memories. Existing memories with the same keys are updated, new ones are created.",
    {
      templateId: z.string().describe("ID of the template to apply"),
    },
    async ({ templateId }) => {
      try {
        const result = await client.applyTemplate(templateId);
        return textResponse(
          JSON.stringify(
            {
              applied: result.applied,
              templateName: result.templateName,
              memoriesCreated: result.memoriesCreated,
              memoriesUpdated: result.memoriesUpdated,
              message: `Template "${result.templateName}" applied: ${result.memoriesCreated} created, ${result.memoriesUpdated} updated.`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error applying template", error);
      }
    },
  );

  server.tool(
    "project_template_create",
    "Create a project template from a list of memory entries. Other projects in the org can then apply this template to bootstrap their context.",
    {
      name: z.string().describe("Template name"),
      description: z.string().optional().describe("Template description"),
      data: z
        .array(
          z.object({
            key: z.string(),
            content: z.string(),
            metadata: z.record(z.unknown()).optional(),
            priority: z.number().optional(),
            tags: z.array(z.string()).optional(),
          }),
        )
        .describe("Array of memory entries for the template"),
    },
    async ({ name, description, data }) => {
      try {
        const result = await client.createTemplate(name, description, data as Array<Record<string, unknown>>);
        return textResponse(
          JSON.stringify(
            {
              created: true,
              templateId: result.template.id,
              templateName: result.template.name,
              entryCount: data.length,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error creating template", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SCHEDULED LIFECYCLE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "lifecycle_schedule",
    "Run all automatic lifecycle policies in one call: cleanup expired memories, prune old session logs, auto-promote frequently accessed entries, auto-demote negatively rated ones. Designed for periodic maintenance.",
    {
      sessionLogMaxAgeDays: z.number().int().optional().default(30).describe("Delete session logs older than this (default 30)"),
      accessThreshold: z.number().int().optional().default(10).describe("Promote memories accessed more than this (default 10)"),
      feedbackThreshold: z.number().int().optional().default(3).describe("Demote memories with unhelpful count above this (default 3)"),
    },
    async ({ sessionLogMaxAgeDays, accessThreshold, feedbackThreshold }) => {
      try {
        const result = await client.runScheduledLifecycle({
          sessionLogMaxAgeDays,
          accessThreshold,
          feedbackThreshold,
        });

        const totalAffected = Object.values(result.results).reduce(
          (sum, r) => sum + r.affected,
          0,
        );

        return textResponse(
          JSON.stringify(
            {
              ranAt: result.ranAt,
              totalAffected,
              policies: result.results,
              message: totalAffected > 0
                ? `Lifecycle complete: ${totalAffected} total entries affected.`
                : "Lifecycle complete: no entries needed maintenance.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error running scheduled lifecycle", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMART RETRIEVE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "smart_retrieve",
    "Single intelligent retrieval tool. Describe what you need in natural language and it combines FTS search, tag matching, key pattern matching, and file path matching to find the best context. Use this instead of figuring out which specific search tool to call.",
    {
      intent: z.string().describe("What context do you need? E.g. 'auth system architecture', 'testing conventions', 'how the API routes work'"),
      files: z
        .array(z.string())
        .optional()
        .describe("File paths you're currently working on — used to find relevant context"),
      maxResults: z.number().int().min(1).max(20).optional().default(5),
      followLinks: z.boolean().optional().default(true).describe("Also return linked/related memories"),
    },
    async ({ intent, files, maxResults, followLinks }) => {
      try {
        const allMemories = await listAllMemories(client);
        const now = Date.now();

        // Score every memory against the intent
        const intentWords = intent.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const filePatterns = (files ?? []).map((f) => f.toLowerCase());

        const scored = allMemories.map((mem) => {
          const content = `${mem.key} ${mem.content ?? ""} ${mem.tags ?? ""}`.toLowerCase();
          let score = 0;

          // Word overlap with intent
          const matchedWords = intentWords.filter((w) => content.includes(w));
          score += matchedWords.length * 10;

          // File path relevance
          for (const fp of filePatterns) {
            const parts = fp.split("/").filter(Boolean);
            for (const part of parts) {
              if (content.includes(part.toLowerCase())) score += 5;
            }
            if (content.includes(fp)) score += 15;
          }

          // Priority boost
          score += (mem.priority ?? 0) * 0.3;

          // Pinned boost
          if (mem.pinnedAt) score += 10;

          // Access frequency boost
          score += Math.min(10, (mem.accessCount ?? 0) * 0.5);

          // Recency boost
          const lastAccess = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
          if (lastAccess) {
            const daysSince = (now - lastAccess) / 86_400_000;
            score += Math.max(0, 5 - daysSince / 7);
          }

          // Feedback boost
          score += ((mem.helpfulCount ?? 0) - (mem.unhelpfulCount ?? 0)) * 2;

          return { mem, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, maxResults).filter((s) => s.score > 0);

        // Follow links for top results
        const linkedKeys = new Set<string>();
        if (followLinks) {
          for (const { mem } of top) {
            if (mem.relatedKeys) {
              try {
                const keys = JSON.parse(mem.relatedKeys as string) as string[];
                keys.forEach((k) => linkedKeys.add(k));
              } catch { /* ignore */ }
            }
          }
          // Remove keys already in top results
          for (const { mem } of top) linkedKeys.delete(mem.key);
        }

        let linked: Array<Record<string, unknown>> = [];
        if (linkedKeys.size > 0) {
          try {
            const bulk = await client.bulkGetMemories([...linkedKeys]);
            linked = Object.values(bulk.memories) as Array<Record<string, unknown>>;
          } catch { /* ignore */ }
        }

        return textResponse(
          JSON.stringify(
            {
              intent,
              resultsCount: top.length,
              linkedCount: linked.length,
              results: top.map(({ mem, score }) => ({
                key: mem.key,
                score: Math.round(score * 10) / 10,
                content: mem.content,
                priority: mem.priority,
                tags: mem.tags,
              })),
              linkedMemories: linked.length > 0
                ? linked.map((m) => ({ key: m.key, content: m.content }))
                : undefined,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error in smart retrieve", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FRESHNESS CHECK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_freshness",
    "Lightweight check: has anything changed since your last sync? Returns a hash and timestamps without downloading content. Compare the hash to your cached value to know if you need a delta sync.",
    {
      cachedHash: z.string().optional().describe("Hash from your previous freshness check. If it matches, nothing changed."),
    },
    async ({ cachedHash }) => {
      try {
        const result = await client.checkFreshness();
        const changed = cachedHash ? cachedHash !== result.hash : true;

        return textResponse(
          JSON.stringify(
            {
              changed,
              hash: result.hash,
              memoryCount: result.memoryCount,
              latestUpdate: result.latestUpdate,
              checkedAt: result.checkedAt,
              message: changed
                ? "Context has changed. Use agent_bootstrap_delta to sync."
                : "No changes since last check. Your cached context is still valid.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error checking freshness", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGENT MEMO BOARD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memo_leave",
    "Leave a note for the next agent session. Memos are actionable items like 'started refactoring auth but didn't finish tests' or 'don't touch config.ts, known issue'. Different from session logs — these are direct agent-to-agent messages.",
    {
      message: z.string().describe("The memo content"),
      urgency: z
        .enum(["info", "warning", "blocker"])
        .optional()
        .default("info")
        .describe("Urgency level: info (FYI), warning (heads up), blocker (must address)"),
      relatedKeys: z
        .array(z.string())
        .optional()
        .describe("Memory keys this memo relates to"),
    },
    async ({ message, urgency, relatedKeys }) => {
      try {
        const id = Date.now().toString(36);
        const key = `agent/memo/${id}`;
        const priorityMap: Record<string, number> = { info: 30, warning: 60, blocker: 90 };
        const ttlMs = urgency === "blocker" ? 7 * 86_400_000 : 3 * 86_400_000; // blockers last 7d, others 3d

        await client.storeMemory(key, message, {
          urgency,
          relatedKeys: relatedKeys ?? [],
          createdAt: new Date().toISOString(),
        }, {
          priority: priorityMap[urgency] ?? 30,
          tags: ["memo", urgency],
          expiresAt: Date.now() + ttlMs,
        });

        return textResponse(`Memo left (${urgency}): "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`);
      } catch (error) {
        return errorResponse("Error leaving memo", error);
      }
    },
  );

  server.tool(
    "memo_read",
    "Read all active memos left by previous agent sessions. Shows actionable items, warnings, and blockers. Call this at session start to see if there's anything important.",
    {},
    async () => {
      try {
        const result = await client.searchMemories("agent/memo/", 50);
        const memos = result as { memories?: Array<Record<string, unknown>> };
        const items = (memos.memories ?? [])
          .filter((m) => String(m.key).startsWith("agent/memo/"))
          .map((m) => {
            let meta: Record<string, unknown> = {};
            try {
              meta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : (m.metadata as Record<string, unknown>) ?? {};
            } catch { /* ignore */ }
            return {
              key: m.key,
              message: m.content,
              urgency: meta.urgency ?? "info",
              relatedKeys: meta.relatedKeys ?? [],
              createdAt: meta.createdAt,
            };
          });

        const blockers = items.filter((m) => m.urgency === "blocker");
        const warnings = items.filter((m) => m.urgency === "warning");
        const infos = items.filter((m) => m.urgency === "info");

        return textResponse(
          JSON.stringify(
            {
              totalMemos: items.length,
              blockers: blockers.length,
              warnings: warnings.length,
              infos: infos.length,
              memos: [...blockers, ...warnings, ...infos],
              hint: items.length === 0
                ? "No memos from previous sessions."
                : blockers.length > 0
                  ? `${blockers.length} BLOCKER(s) require attention before proceeding.`
                  : "Review memos and proceed.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error reading memos", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY SIZE WARNINGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_size_audit",
    "Find oversized memories that consume disproportionate token budget. Returns memories sorted by size with suggestions for splitting. Memories over 4000 chars (~1000 tokens) are flagged.",
    {
      threshold: z.number().int().optional().default(4000).describe("Character threshold to flag (default 4000 = ~1000 tokens)"),
    },
    async ({ threshold }) => {
      try {
        const allMemories = await listAllMemories(client);
        const CHARS_PER_TOKEN = 4;

        const oversized = allMemories
          .filter((m) => (m.content?.length ?? 0) > threshold)
          .map((m) => {
            const len = m.content?.length ?? 0;
            const tokenEst = Math.ceil(len / CHARS_PER_TOKEN);
            // Count sections (headings) to estimate splittability
            const headings = (m.content ?? "").match(/^#{1,3}\s+.+$/gm) ?? [];
            return {
              key: m.key,
              chars: len,
              tokenEstimate: tokenEst,
              headingsCount: headings.length,
              canSplit: headings.length >= 2,
              suggestion: headings.length >= 2
                ? `This memory has ${headings.length} sections. Consider splitting into ${headings.length} separate memories.`
                : len > threshold * 3
                  ? "Very large memory. Consider summarizing or breaking into focused sub-entries."
                  : "Slightly over threshold. Acceptable if content is cohesive.",
            };
          })
          .sort((a, b) => b.chars - a.chars);

        const totalTokens = allMemories.reduce(
          (sum, m) => sum + Math.ceil((m.content?.length ?? 0) / CHARS_PER_TOKEN),
          0,
        );
        const oversizedTokens = oversized.reduce((sum, m) => sum + m.tokenEstimate, 0);

        return textResponse(
          JSON.stringify(
            {
              totalMemories: allMemories.length,
              totalTokenEstimate: totalTokens,
              oversizedCount: oversized.length,
              oversizedTokenEstimate: oversizedTokens,
              oversizedPercentage: totalTokens > 0 ? Math.round((oversizedTokens / totalTokens) * 100) : 0,
              oversized,
              hint: oversized.length > 0
                ? `${oversized.length} memories exceed ${threshold} chars. They consume ${Math.round((oversizedTokens / totalTokens) * 100)}% of your total token budget.`
                : "No oversized memories found.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error auditing memory sizes", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UNDO / ROLLBACK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_undo",
    "Undo the last N changes to a memory. Rolls back to a previous version using the version history. The current content is saved as a new version before rollback (so you can undo the undo).",
    {
      key: z.string().describe("Memory key to rollback"),
      steps: z.number().int().min(1).max(50).optional().default(1).describe("Number of versions to go back (default 1)"),
    },
    async ({ key, steps }) => {
      try {
        const result = await client.rollbackMemory(key, steps);
        return textResponse(
          JSON.stringify(
            {
              key: result.key,
              rolledBackTo: `version ${result.rolledBackTo}`,
              stepsBack: result.stepsBack,
              previousContent: result.previousContent,
              restoredContent: result.restoredContent,
              message: `Rolled back "${key}" by ${steps} version(s). Current state saved as version ${result.newVersion} (can undo this rollback).`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error rolling back memory", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTEXT THREADING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "context_thread",
    "Show which memories were actively read/written in recent sessions. Highlights 'hot' memories that were being worked on. Call at session start to continue where the last agent left off.",
    {
      sessionCount: z.number().int().min(1).max(10).optional().default(3).describe("How many recent sessions to analyze (default 3)"),
    },
    async ({ sessionCount }) => {
      try {
        const sessions = await client.getSessionLogs(sessionCount);
        const logs = sessions.sessionLogs ?? [];

        const hotKeys: Record<string, { reads: number; writes: number; lastSession: string }> = {};

        for (const log of logs) {
          const read = log.keysRead ? JSON.parse(log.keysRead as string) as string[] : [];
          const written = log.keysWritten ? JSON.parse(log.keysWritten as string) as string[] : [];

          for (const k of read) {
            if (!hotKeys[k]) hotKeys[k] = { reads: 0, writes: 0, lastSession: "" };
            hotKeys[k].reads++;
            if (!hotKeys[k].lastSession) hotKeys[k].lastSession = log.sessionId;
          }
          for (const k of written) {
            if (!hotKeys[k]) hotKeys[k] = { reads: 0, writes: 0, lastSession: "" };
            hotKeys[k].writes++;
            if (!hotKeys[k].lastSession) hotKeys[k].lastSession = log.sessionId;
          }
        }

        // Sort by activity (writes first, then reads)
        const sorted = Object.entries(hotKeys)
          .map(([key, stats]) => ({
            key,
            ...stats,
            activity: stats.writes * 3 + stats.reads,
          }))
          .sort((a, b) => b.activity - a.activity);

        const activelyEdited = sorted.filter((s) => s.writes > 0);
        const readOnly = sorted.filter((s) => s.writes === 0);

        return textResponse(
          JSON.stringify(
            {
              sessionsAnalyzed: logs.length,
              hotMemories: sorted.length,
              activelyEdited: activelyEdited.slice(0, 10),
              frequentlyRead: readOnly.slice(0, 10),
              hint: activelyEdited.length > 0
                ? `${activelyEdited.length} memories were being actively edited. Consider reading these first to continue the work.`
                : "No recent edits. Starting fresh.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error fetching context thread", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BRANCH-AWARE MEMORY FILTER (Feature 1)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_branch_filter",
    "List memories by branch tag, or list all branches with counts. Useful for understanding which memories are branch-specific vs global.",
    {
      branch: z
        .string()
        .optional()
        .describe("Filter memories by this branch. Omit to list all branches with counts."),
    },
    async ({ branch }) => {
      try {
        const allMemories = await listAllMemories(client);

        if (branch) {
          const branchTag = `branch:${branch}`;
          const branchMemories = allMemories.filter((m) => {
            try {
              const tags = JSON.parse(m.tags ?? "[]") as string[];
              return tags.includes(branchTag);
            } catch { return false; }
          });

          return textResponse(
            JSON.stringify(
              {
                branch,
                count: branchMemories.length,
                memories: branchMemories.map((m) => ({
                  key: m.key,
                  priority: m.priority,
                  updatedAt: m.updatedAt,
                  contentPreview: (m.content ?? "").slice(0, 120),
                })),
              },
              null,
              2,
            ),
          );
        }

        // List all branches with counts
        const branchCounts: Record<string, number> = {};
        let globalCount = 0;

        for (const m of allMemories) {
          let tags: string[] = [];
          try { tags = JSON.parse(m.tags ?? "[]") as string[]; } catch { /* ignore */ }
          const branchTags = tags.filter((t) => t.startsWith("branch:"));
          if (branchTags.length === 0) {
            globalCount++;
          } else {
            for (const bt of branchTags) {
              const name = bt.replace("branch:", "");
              branchCounts[name] = (branchCounts[name] ?? 0) + 1;
            }
          }
        }

        return textResponse(
          JSON.stringify(
            {
              globalCount,
              branches: Object.entries(branchCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ branch: name, count })),
              totalMemories: allMemories.length,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error filtering by branch", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY COMPILATION (Feature 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_compile",
    "Compile all memories into a single structured document. Filters by types/tags/branch, groups by type, sorts by priority. Token budget via knapsack. Two formats: markdown (full with TOC) and condensed (stripped headers).",
    {
      types: z.array(z.string()).optional().describe("Only include these context types"),
      tags: z.array(z.string()).optional().describe("Only include memories with these tags"),
      branch: z.string().optional().describe("Include branch-tagged memories for this branch"),
      maxTokens: z.number().int().min(100).max(200000).default(16000).describe("Token budget"),
      format: z.enum(["markdown", "condensed"]).default("markdown").describe("Output format"),
    },
    async ({ types, tags, branch, maxTokens, format }) => {
      try {
        const allMemories = await listAllMemories(client);
        const entries = extractAgentContextEntries(allMemories);
        const allTypeInfo = await getAllContextTypeInfo(client);

        // Filter
        let filtered = entries;
        if (types) filtered = filtered.filter((e) => types.includes(e.type));
        if (tags) {
          filtered = filtered.filter((e) =>
            tags.some((t) => e.tags.includes(t)),
          );
        }
        if (branch) {
          const branchTag = `branch:${branch}`;
          // Include branch-tagged + global (no branch tag)
          filtered = filtered.filter((e) => {
            const hasBranchTag = e.tags.some((t) => t.startsWith("branch:"));
            return e.tags.includes(branchTag) || !hasBranchTag;
          });
        }

        // Sort by priority descending
        filtered.sort((a, b) => b.priority - a.priority);

        // Knapsack by token budget
        const CHARS_PER_TOKEN = 4;
        let budgetChars = maxTokens * CHARS_PER_TOKEN;
        const selected: typeof filtered = [];
        for (const entry of filtered) {
          if (entry.content.length <= budgetChars) {
            selected.push(entry);
            budgetChars -= entry.content.length;
          }
          if (budgetChars <= 0) break;
        }

        // Group by type
        const byType: Record<string, typeof selected> = {};
        for (const entry of selected) {
          if (!byType[entry.type]) byType[entry.type] = [];
          byType[entry.type].push(entry);
        }

        if (format === "condensed") {
          const parts: string[] = [];
          for (const [type, typeEntries] of Object.entries(byType)) {
            parts.push(`[${allTypeInfo[type]?.label ?? type}]`);
            for (const e of typeEntries) {
              parts.push(e.content);
            }
            parts.push("");
          }
          return textResponse(parts.join("\n"));
        }

        // Markdown format with TOC
        const lines: string[] = ["# Compiled Memory Context", ""];

        // TOC
        lines.push("## Table of Contents");
        for (const [type] of Object.entries(byType)) {
          const label = allTypeInfo[type]?.label ?? type;
          lines.push(`- [${label}](#${type})`);
        }
        lines.push("");

        for (const [type, typeEntries] of Object.entries(byType)) {
          const label = allTypeInfo[type]?.label ?? type;
          lines.push(`## ${label}`);
          lines.push("");
          for (const e of typeEntries) {
            if (typeEntries.length > 1) {
              lines.push(`### ${e.title}`);
              lines.push("");
            }
            lines.push(e.content);
            lines.push("");
          }
        }

        const totalTokens = selected.reduce(
          (sum, e) => sum + Math.ceil(e.content.length / CHARS_PER_TOKEN),
          0,
        );

        return textResponse(
          `${lines.join("\n")}\n---\n_Compiled ${selected.length} entries (~${totalTokens} tokens) from ${filtered.length} candidates._`,
        );
      } catch (error) {
        return errorResponse("Error compiling memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTRADICTION DETECTION (Feature 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_contradictions",
    "Detect conflicting directives across memories. Finds pairs like 'use Jest' vs 'use Vitest', 'always X' vs 'never X', 'prefer A' vs 'avoid A'. Returns conflicting pairs with confidence.",
    {},
    async () => {
      try {
        const allMemories = await listAllMemories(client);

        interface Directive {
          key: string;
          verb: string;
          subject: string;
          snippet: string;
        }

        const directives: Directive[] = [];

        // Regex patterns for directive extraction
        const patterns = [
          /\b(use|prefer|always use|choose|require)\s+(\w[\w\s.-]{0,30}\w)/gi,
          /\b(avoid|never use|don't use|do not use|never)\s+(\w[\w\s.-]{0,30}\w)/gi,
          /\b(always|must|should always)\s+(\w[\w\s.-]{0,30}\w)/gi,
          /\b(never|must not|should never|don't|do not)\s+(\w[\w\s.-]{0,30}\w)/gi,
        ];

        for (const mem of allMemories) {
          const content = mem.content ?? "";
          for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(content)) !== null) {
              const verb = match[1]!.toLowerCase();
              const subject = match[2]!.toLowerCase().trim();
              if (subject.length < 3) continue;
              const lineStart = content.lastIndexOf("\n", match.index) + 1;
              const lineEnd = content.indexOf("\n", match.index);
              const snippet = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 120);
              directives.push({ key: mem.key, verb, subject, snippet });
            }
          }
        }

        // Find contradictions
        const positiveVerbs = new Set(["use", "prefer", "always use", "choose", "require", "always", "must", "should always"]);
        const negativeVerbs = new Set(["avoid", "never use", "don't use", "do not use", "never", "must not", "should never", "don't", "do not"]);

        interface Conflict {
          memoryA: string;
          snippetA: string;
          memoryB: string;
          snippetB: string;
          subject: string;
          confidence: number;
        }

        const conflicts: Conflict[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < directives.length; i++) {
          for (let j = i + 1; j < directives.length; j++) {
            const a = directives[i]!;
            const b = directives[j]!;
            if (a.key === b.key) continue;

            // Check if subjects overlap
            const subjectOverlap =
              a.subject === b.subject ||
              a.subject.includes(b.subject) ||
              b.subject.includes(a.subject);

            if (!subjectOverlap) continue;

            const aPositive = positiveVerbs.has(a.verb);
            const aNegative = negativeVerbs.has(a.verb);
            const bPositive = positiveVerbs.has(b.verb);
            const bNegative = negativeVerbs.has(b.verb);

            if ((aPositive && bNegative) || (aNegative && bPositive)) {
              const conflictKey = [a.key, b.key].sort().join("|") + "|" + a.subject;
              if (seen.has(conflictKey)) continue;
              seen.add(conflictKey);

              const confidence = a.subject === b.subject ? 0.9 : 0.6;
              conflicts.push({
                memoryA: a.key,
                snippetA: a.snippet,
                memoryB: b.key,
                snippetB: b.snippet,
                subject: a.subject,
                confidence,
              });
            }
          }
        }

        conflicts.sort((a, b) => b.confidence - a.confidence);

        return textResponse(
          JSON.stringify(
            {
              directivesFound: directives.length,
              contradictions: conflicts.length,
              conflicts: conflicts.slice(0, 20),
              hint: conflicts.length > 0
                ? `Found ${conflicts.length} potential contradictions. Review and resolve to avoid conflicting guidance.`
                : "No contradictions detected.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error detecting contradictions", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // IMPACT ANALYSIS (Feature 4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_impact",
    "Scan all memories for references to a specific key. Shows which memories link to, mention, or depend on a given memory. Use before updating or deleting critical memories.",
    {
      key: z.string().describe("Memory key to analyze impact for"),
    },
    async ({ key }) => {
      try {
        const allMemories = await listAllMemories(client);
        const keyLower = key.toLowerCase();

        const impacted = allMemories
          .filter((m) => {
            if (m.key === key) return false;
            const content = (m.content ?? "").toLowerCase();
            const relatedKeys = (m.relatedKeys ?? "").toLowerCase();
            const metadata = typeof m.metadata === "string" ? m.metadata.toLowerCase() : "";
            return content.includes(keyLower) || relatedKeys.includes(keyLower) || metadata.includes(keyLower);
          })
          .map((m) => {
            const referenceTypes: string[] = [];
            if ((m.content ?? "").toLowerCase().includes(keyLower)) referenceTypes.push("content");
            if ((m.relatedKeys ?? "").toLowerCase().includes(keyLower)) referenceTypes.push("relatedKeys");
            if (typeof m.metadata === "string" && m.metadata.toLowerCase().includes(keyLower)) referenceTypes.push("metadata");
            return {
              key: m.key,
              referenceTypes,
              priority: m.priority ?? 0,
              contentPreview: (m.content ?? "").slice(0, 120),
            };
          });

        return textResponse(
          JSON.stringify(
            {
              analyzedKey: key,
              impactedCount: impacted.length,
              impacted,
              hint: impacted.length > 0
                ? `${impacted.length} memories reference "${key}". Updating or deleting it may affect these memories.`
                : `No other memories reference "${key}". Safe to modify or delete.`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error analyzing impact", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ORG DEFAULTS (Feature 6)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "org_defaults_list",
    "List organization-wide default memories. These can be applied to any project to bootstrap standard context (coding style, architecture patterns, etc).",
    {},
    async () => {
      try {
        const result = await client.listOrgDefaults();
        return textResponse(
          JSON.stringify(
            {
              count: result.defaults.length,
              defaults: result.defaults.map((d) => ({
                key: d.key,
                priority: d.priority,
                tags: d.tags,
                contentPreview: d.content.slice(0, 120),
                updatedAt: d.updatedAt,
              })),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error listing org defaults", error);
      }
    },
  );

  server.tool(
    "org_defaults_set",
    "Create or update an organization-wide default memory. When applied to a project, this memory will be created with the specified content, priority, and tags.",
    {
      key: z.string().describe("Memory key for the default"),
      content: z.string().describe("Default content"),
      metadata: z.record(z.unknown()).optional().describe("Optional metadata"),
      priority: z.number().int().min(0).max(100).optional().describe("Default priority"),
      tags: z.array(z.string()).optional().describe("Default tags"),
    },
    async ({ key, content, metadata, priority, tags }) => {
      try {
        await client.setOrgDefault({ key, content, metadata, priority, tags });
        return textResponse(`Org default set: ${key}`);
      } catch (error) {
        return errorResponse("Error setting org default", error);
      }
    },
  );

  server.tool(
    "org_defaults_apply",
    "Apply all organization defaults to the current project. Existing memories with the same key are updated, new ones are created. Use this to bootstrap a new project with org-wide standards.",
    {},
    async () => {
      try {
        const result = await client.applyOrgDefaults();
        return textResponse(
          JSON.stringify(
            {
              applied: result.applied,
              memoriesCreated: result.memoriesCreated,
              memoriesUpdated: result.memoriesUpdated,
              totalDefaults: result.totalDefaults,
              message: `Applied ${result.totalDefaults} org defaults: ${result.memoriesCreated} created, ${result.memoriesUpdated} updated.`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error applying org defaults", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGENT ONBOARDING (Feature 7)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "agent_onboard",
    "Scan the repository for config files (package.json, tsconfig, eslint, test configs, Dockerfile, CI workflows) and auto-detect framework, language, test runner, and package manager. Generates suggested memories for coding style, testing, architecture, workflow, and folder structure. Use apply=true to store immediately.",
    {
      apply: z
        .boolean()
        .default(false)
        .describe("If true, store the generated memories immediately"),
    },
    async ({ apply }) => {
      try {
        const cwd = process.cwd();
        const detected: Record<string, string> = {};
        const suggestions: Array<{ type: string; id: string; title: string; content: string; priority: number }> = [];

        // Read config files
        async function readFile(path: string): Promise<string | null> {
          try {
            const result = await execFileAsync("cat", [path], { cwd });
            return result.stdout;
          } catch { return null; }
        }

        // Package manager detection
        const yarnLock = await readFile("yarn.lock");
        const pnpmLock = await readFile("pnpm-lock.yaml");
        const bunLock = await readFile("bun.lockb");
        if (pnpmLock) detected.packageManager = "pnpm";
        else if (bunLock) detected.packageManager = "bun";
        else if (yarnLock) detected.packageManager = "yarn";
        else detected.packageManager = "npm";

        // package.json analysis
        const pkgJson = await readFile("package.json");
        if (pkgJson) {
          try {
            const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
            const deps = { ...(pkg.dependencies as Record<string, string> | undefined ?? {}), ...(pkg.devDependencies as Record<string, string> | undefined ?? {}) };

            // Framework detection
            if (deps.next) detected.framework = "Next.js";
            else if (deps.nuxt) detected.framework = "Nuxt";
            else if (deps.svelte || deps["@sveltejs/kit"]) detected.framework = "SvelteKit";
            else if (deps.react) detected.framework = "React";
            else if (deps.vue) detected.framework = "Vue";
            else if (deps.express) detected.framework = "Express";
            else if (deps.fastify) detected.framework = "Fastify";
            else if (deps.hono) detected.framework = "Hono";

            // Test runner detection
            if (deps.vitest) detected.testRunner = "vitest";
            else if (deps.jest) detected.testRunner = "jest";
            else if (deps.mocha) detected.testRunner = "mocha";
            else if (deps.playwright || deps["@playwright/test"]) detected.testRunner = "playwright";
            else if (deps.cypress) detected.testRunner = "cypress";

            // Language detection
            if (deps.typescript) detected.language = "TypeScript";
            else detected.language = "JavaScript";

            // Linter
            if (deps.eslint) detected.linter = "ESLint";
            if (deps.biome || deps["@biomejs/biome"]) detected.linter = "Biome";

            // Formatter
            if (deps.prettier) detected.formatter = "Prettier";

            // Monorepo
            if (pkg.workspaces) detected.monorepo = "npm/yarn workspaces";
          } catch { /* ignore parse errors */ }
        }

        // pnpm workspace check
        const pnpmWorkspace = await readFile("pnpm-workspace.yaml");
        if (pnpmWorkspace) detected.monorepo = "pnpm workspaces";

        // tsconfig check
        const tsconfig = await readFile("tsconfig.json");
        if (tsconfig) detected.language = "TypeScript";

        // Docker check
        const dockerfile = await readFile("Dockerfile");
        if (dockerfile) detected.docker = "yes";

        // CI check
        const ghActions = await readFile(".github/workflows/ci.yml") ?? await readFile(".github/workflows/ci.yaml");
        if (ghActions) detected.ci = "GitHub Actions";

        // Generate suggestions
        if (detected.language || detected.framework) {
          const parts: string[] = [];
          if (detected.language) parts.push(`- Language: ${detected.language}`);
          if (detected.framework) parts.push(`- Framework: ${detected.framework}`);
          if (detected.packageManager) parts.push(`- Package manager: ${detected.packageManager}`);
          if (detected.linter) parts.push(`- Linter: ${detected.linter}`);
          if (detected.formatter) parts.push(`- Formatter: ${detected.formatter}`);
          if (detected.monorepo) parts.push(`- Monorepo: ${detected.monorepo}`);
          suggestions.push({
            type: "coding_style",
            id: "project-stack",
            title: "Project Stack & Conventions",
            content: `## Tech Stack\n${parts.join("\n")}`,
            priority: 80,
          });
        }

        if (detected.testRunner) {
          suggestions.push({
            type: "testing",
            id: "test-setup",
            title: "Test Setup",
            content: `## Test Runner\n- Runner: ${detected.testRunner}\n- Run: \`${detected.packageManager} ${detected.packageManager === "npm" ? "run " : ""}test\``,
            priority: 70,
          });
        }

        if (detected.framework) {
          suggestions.push({
            type: "architecture",
            id: "framework-overview",
            title: "Architecture Overview",
            content: `## Framework\n- ${detected.framework}${detected.monorepo ? `\n- Monorepo: ${detected.monorepo}` : ""}${detected.docker ? "\n- Containerized with Docker" : ""}`,
            priority: 75,
          });
        }

        if (detected.ci) {
          suggestions.push({
            type: "workflow",
            id: "ci-cd",
            title: "CI/CD",
            content: `## CI/CD\n- Platform: ${detected.ci}`,
            priority: 60,
          });
        }

        // Folder structure from git
        try {
          const result = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd, maxBuffer: 5 * 1024 * 1024 });
          const files = result.stdout.trim().split("\n").filter(Boolean);
          const topDirs = [...new Set(files.map((f) => f.split("/")[0]).filter(Boolean))].sort();
          if (topDirs.length > 0) {
            suggestions.push({
              type: "folder_structure",
              id: "repo-layout",
              title: "Repository Layout",
              content: `## Top-level Directories\n${topDirs.map((d) => `- ${d}/`).join("\n")}\n\n_${files.length} files total_`,
              priority: 65,
            });
          }
        } catch { /* ignore */ }

        if (apply && suggestions.length > 0) {
          const results: Array<{ key: string; status: string }> = [];
          for (const s of suggestions) {
            const key = buildAgentContextKey(s.type, s.id);
            try {
              await client.storeMemory(key, s.content, {
                scope: "agent_functionality",
                type: s.type,
                id: s.id,
                title: s.title,
                updatedByTool: "agent_onboard",
                updatedAt: new Date().toISOString(),
              }, { priority: s.priority });
              results.push({ key, status: "stored" });
            } catch (err) {
              results.push({ key, status: `error: ${err instanceof Error ? err.message : String(err)}` });
            }
          }
          return textResponse(
            JSON.stringify(
              {
                detected,
                applied: true,
                stored: results.filter((r) => r.status === "stored").length,
                errors: results.filter((r) => r.status.startsWith("error")).length,
                details: results,
              },
              null,
              2,
            ),
          );
        }

        return textResponse(
          JSON.stringify(
            {
              detected,
              suggestions: suggestions.map((s) => ({
                type: s.type,
                id: s.id,
                title: s.title,
                key: buildAgentContextKey(s.type, s.id),
                priority: s.priority,
                contentPreview: s.content.slice(0, 200),
              })),
              hint: suggestions.length > 0
                ? `Found ${suggestions.length} suggestions. Call again with apply=true to store them.`
                : "No configs detected. This may not be a standard project.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error during onboarding scan", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION RATE STATUS (Feature 8)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "session_rate_status",
    "Show current session write rate limit status: calls made, limit, remaining, and percentage used.",
    {},
    async () => {
      const pct = Math.round((writeCallCount / RATE_LIMIT) * 100);
      return textResponse(
        JSON.stringify(
          {
            callsMade: writeCallCount,
            limit: RATE_LIMIT,
            remaining: Math.max(0, RATE_LIMIT - writeCallCount),
            percentageUsed: pct,
            status: pct >= 100 ? "blocked" : pct >= 80 ? "warning" : "ok",
          },
          null,
          2,
        ),
      );
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY QUALITY SCORE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_quality",
    "Score memories on content quality (not just staleness). Checks: too short, unstructured, no headings, poor feedback ratio, conflicting content. Sorted worst-first to prioritize updates.",
    {
      limit: z.number().int().min(1).max(100).optional().default(30),
    },
    async ({ limit }) => {
      try {
        const allMemories = await listAllMemories(client);

        const scored = allMemories.map((mem) => {
          const content = mem.content ?? "";
          const len = content.length;
          const issues: string[] = [];
          let score = 100;

          // Length check
          if (len < 50) {
            score -= 30;
            issues.push("Very short content (< 50 chars). May not be useful.");
          } else if (len < 150) {
            score -= 10;
            issues.push("Short content. Consider adding more detail.");
          }

          // Structure check (has headings/sections?)
          const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
          const hasBullets = /^[-*]\s+/m.test(content);
          if (len > 500 && headings.length === 0 && !hasBullets) {
            score -= 15;
            issues.push("Long unstructured content. Add headings or bullet points.");
          }

          // Feedback ratio
          const helpful = mem.helpfulCount ?? 0;
          const unhelpful = mem.unhelpfulCount ?? 0;
          const totalFeedback = helpful + unhelpful;
          if (totalFeedback >= 3 && unhelpful > helpful) {
            score -= 25;
            issues.push(`Negative feedback ratio (${helpful} helpful, ${unhelpful} unhelpful).`);
          }

          // Staleness (no access in 30+ days)
          const lastAccess = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
          if (lastAccess) {
            const daysSince = (Date.now() - lastAccess) / 86_400_000;
            if (daysSince > 60) {
              score -= 20;
              issues.push(`Not accessed in ${Math.round(daysSince)} days.`);
            } else if (daysSince > 30) {
              score -= 10;
              issues.push(`Not accessed in ${Math.round(daysSince)} days.`);
            }
          }

          // Placeholder/TODO content
          if (/TODO|FIXME|PLACEHOLDER|TBD/i.test(content)) {
            score -= 15;
            issues.push("Contains TODO/FIXME markers. Needs completion.");
          }

          // Duplicate-ish short content
          if (len > 0 && len < 100 && (mem.priority ?? 0) === 0) {
            score -= 5;
            issues.push("Low-priority short entry. Consider if this is still needed.");
          }

          return {
            key: mem.key,
            qualityScore: Math.max(0, score),
            issues,
            contentLength: len,
            priority: mem.priority ?? 0,
            accessCount: mem.accessCount ?? 0,
          };
        });

        scored.sort((a, b) => a.qualityScore - b.qualityScore);
        const results = scored.slice(0, limit);
        const lowQuality = results.filter((m) => m.qualityScore < 50);

        return textResponse(
          JSON.stringify(
            {
              totalMemories: allMemories.length,
              analyzed: results.length,
              lowQualityCount: lowQuality.length,
              averageQuality: Math.round(scored.reduce((s, m) => s + m.qualityScore, 0) / (scored.length || 1)),
              memories: results,
              hint: lowQuality.length > 0
                ? `${lowQuality.length} memories have quality score below 50. Update, expand, or archive them.`
                : "All analyzed memories have acceptable quality.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error scoring memory quality", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY DEPENDENCY GRAPH (Batch 2 – Feature 1)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_graph",
    "Build a dependency graph from relatedKeys across all memories. Returns nodes, edges, connected clusters, orphans, and cycles.",
    {},
    async () => {
      try {
        const allMemories = await listAllMemories(client);

        // Build adjacency list
        const adjacency: Record<string, string[]> = {};
        const allKeys = new Set<string>();

        for (const mem of allMemories) {
          allKeys.add(mem.key);
          let related: string[] = [];
          if (mem.relatedKeys) {
            try { related = JSON.parse(mem.relatedKeys as string); } catch { /* skip */ }
          }
          adjacency[mem.key] = related.filter((k) => k !== mem.key);
        }

        // Build undirected edges for cluster detection
        const nodes = Array.from(allKeys);
        const edges: Array<{ from: string; to: string }> = [];
        const undirected: Record<string, Set<string>> = {};

        for (const key of nodes) {
          undirected[key] = new Set();
        }

        for (const [from, tos] of Object.entries(adjacency)) {
          for (const to of tos) {
            if (allKeys.has(to)) {
              edges.push({ from, to });
              undirected[from]!.add(to);
              undirected[to]!.add(from);
            }
          }
        }

        // BFS to find connected components
        const visited = new Set<string>();
        const clusters: string[][] = [];

        for (const node of nodes) {
          if (visited.has(node)) continue;
          const neighbors = undirected[node];
          if (!neighbors || neighbors.size === 0) continue;

          const cluster: string[] = [];
          const queue = [node];
          visited.add(node);

          while (queue.length > 0) {
            const current = queue.shift()!;
            cluster.push(current);
            for (const neighbor of undirected[current] ?? []) {
              if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
              }
            }
          }

          clusters.push(cluster);
        }

        // Orphans: nodes with no edges
        const orphans = nodes.filter((n) => !visited.has(n));

        // DFS 3-color cycle detection on directed graph
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color: Record<string, number> = {};
        for (const n of nodes) color[n] = WHITE;
        const cycles: string[][] = [];

        function dfs(node: string, path: string[]) {
          color[node] = GRAY;
          path.push(node);

          for (const neighbor of adjacency[node] ?? []) {
            if (!allKeys.has(neighbor)) continue;
            if (color[neighbor] === GRAY) {
              // Found cycle — extract from where neighbor appears in path
              const cycleStart = path.indexOf(neighbor);
              if (cycleStart >= 0) {
                cycles.push(path.slice(cycleStart));
              }
            } else if (color[neighbor] === WHITE) {
              dfs(neighbor, path);
            }
          }

          path.pop();
          color[node] = BLACK;
        }

        for (const node of nodes) {
          if (color[node] === WHITE) {
            dfs(node, []);
          }
        }

        return textResponse(
          JSON.stringify(
            {
              totalNodes: nodes.length,
              totalEdges: edges.length,
              clusters: clusters.map((c, i) => ({ id: i, size: c.length, keys: c })),
              orphans,
              cycles,
              adjacency,
              hint: cycles.length > 0
                ? `Found ${cycles.length} cycle(s) in memory relationships. Review for circular dependencies.`
                : orphans.length > 0
                  ? `${orphans.length} memories have no relationships. Consider linking them or archiving unused ones.`
                  : "Memory graph is healthy with no cycles.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error building memory graph", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BRANCH MERGE RECONCILIATION (Batch 2 – Feature 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_branch_merge",
    "After merging a branch, promote branch-specific memories to global or archive them. Finds memories with branch:<name> tag.",
    {
      branch: z.string().describe("Branch name whose memories to reconcile"),
      action: z
        .enum(["promote", "archive"])
        .describe("'promote' removes branch tag (making memory global), 'archive' archives all branch memories"),
      dryRun: z
        .boolean()
        .default(false)
        .describe("Preview changes without applying them"),
    },
    async ({ branch, action, dryRun }) => {
      try {
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed && !dryRun) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }

        const allMemories = await listAllMemories(client);
        const branchTag = `branch:${branch}`;

        // Find memories with this branch tag
        const branchMemories = allMemories.filter((mem) => {
          if (!mem.tags) return false;
          try {
            const tags = JSON.parse(mem.tags as string) as string[];
            return tags.includes(branchTag);
          } catch {
            return false;
          }
        });

        if (branchMemories.length === 0) {
          return textResponse(
            JSON.stringify({
              branch,
              action,
              found: 0,
              affected: 0,
              message: `No memories found with tag "${branchTag}".`,
            }, null, 2),
          );
        }

        if (dryRun) {
          return textResponse(
            JSON.stringify({
              branch,
              action,
              dryRun: true,
              found: branchMemories.length,
              keys: branchMemories.map((m) => m.key),
              message: `Would ${action} ${branchMemories.length} memories with tag "${branchTag}".`,
            }, null, 2),
          );
        }

        let affected = 0;

        if (action === "promote") {
          // Remove branch tag from each memory
          for (const mem of branchMemories) {
            let tags: string[] = [];
            try { tags = JSON.parse(mem.tags as string); } catch { /* skip */ }
            const newTags = tags.filter((t) => t !== branchTag);
            await client.updateMemory(mem.key, undefined, undefined, { tags: newTags });
            writeCallCount++;
            affected++;
          }
        } else {
          // Archive all branch memories via batch
          const keys = branchMemories.map((m) => m.key);
          const result = await client.batchMutate(keys, "archive") as { affected: number };
          writeCallCount++;
          affected = result.affected;
        }

        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";

        return textResponse(
          JSON.stringify({
            branch,
            action,
            found: branchMemories.length,
            affected,
            keys: branchMemories.map((m) => m.key),
            message: `${action === "promote" ? "Promoted" : "Archived"} ${affected} memories from branch "${branch}".${rateWarn}`,
          }, null, 2),
        );
      } catch (error) {
        return errorResponse("Error reconciling branch memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMORY SCHEMA VALIDATION (Batch 2 – Feature 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_validate_schema",
    "Validate memory content against custom context type schemas. Checks required fields and property types for JSON content, or heading structure for markdown content.",
    {
      type: z
        .string()
        .optional()
        .describe("Only validate memories of this context type"),
      key: z
        .string()
        .optional()
        .describe("Only validate a specific memory key"),
    },
    async ({ type, key }) => {
      try {
        const allMemories = await listAllMemories(client);
        const customTypes = await getCustomContextTypes(client);

        // Filter to types that have schemas
        const typesWithSchemas = customTypes.filter((t) => t.schema);
        if (typesWithSchemas.length === 0) {
          return textResponse(
            JSON.stringify({
              validated: 0,
              valid: 0,
              invalid: 0,
              issues: [],
              hint: "No custom context types with schemas defined. Create types with schemas via context_type_create.",
            }, null, 2),
          );
        }

        const entries = extractAgentContextEntries(allMemories);

        // Filter entries by type/key if specified
        let filtered = entries;
        if (type) {
          filtered = filtered.filter((e) => e.type === type);
        }
        if (key) {
          filtered = filtered.filter((e) => e.key === key);
        }

        const issues: Array<{
          key: string;
          type: string;
          errors: string[];
        }> = [];

        for (const entry of filtered) {
          const ctType = typesWithSchemas.find((t) => t.slug === entry.type);
          if (!ctType || !ctType.schema) continue;

          let schema: Record<string, unknown>;
          try {
            schema = JSON.parse(ctType.schema);
          } catch {
            continue;
          }

          const content = entry.content;
          const entryErrors: string[] = [];

          // Try JSON validation first
          const requiredFields = (schema.required as string[]) ?? [];
          const properties = (schema.properties as Record<string, { type?: string }>) ?? {};

          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(content);
          } catch {
            // Not JSON — try markdown heading validation
            if (Object.keys(properties).length > 0) {
              const headings = content.match(/^#{1,6}\s+(.+)$/gm)?.map((h) =>
                h.replace(/^#{1,6}\s+/, "").trim().toLowerCase(),
              ) ?? [];

              for (const req of requiredFields) {
                if (!headings.some((h) => h.includes(req.toLowerCase()))) {
                  entryErrors.push(`Missing required section heading: "${req}"`);
                }
              }
            }
          }

          if (parsed && typeof parsed === "object") {
            // Check required fields
            for (const req of requiredFields) {
              if (!(req in parsed) || parsed[req] === null || parsed[req] === undefined) {
                entryErrors.push(`Missing required field: "${req}"`);
              }
            }

            // Check property types
            for (const [prop, def] of Object.entries(properties)) {
              if (prop in parsed && def.type) {
                const actual = Array.isArray(parsed[prop]) ? "array" : typeof parsed[prop];
                if (actual !== def.type) {
                  entryErrors.push(`Field "${prop}" should be ${def.type}, got ${actual}`);
                }
              }
            }
          }

          if (entryErrors.length > 0) {
            issues.push({ key: entry.key, type: entry.type, errors: entryErrors });
          }
        }

        const validated = filtered.filter((e) =>
          typesWithSchemas.some((t) => t.slug === e.type),
        ).length;

        return textResponse(
          JSON.stringify(
            {
              validated,
              valid: validated - issues.length,
              invalid: issues.length,
              issues,
              schemasChecked: typesWithSchemas.map((t) => t.slug),
              hint: issues.length > 0
                ? `${issues.length} memories have schema violations. Update their content to match the schema.`
                : "All validated memories conform to their schemas.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error validating memory schemas", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SESSION CLAIMS – ADVISORY LOCKS (Batch 2 – Feature 4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "session_claim",
    "Claim memory keys for the current session (advisory lock). Other agents can see which keys are claimed. Non-blocking — doesn't prevent writes.",
    {
      sessionId: z.string().describe("Unique session identifier"),
      keys: z.array(z.string()).describe("Memory keys this session intends to work on"),
      ttlMinutes: z
        .number()
        .default(30)
        .describe("How long the claim lasts (minutes, default 30)"),
    },
    async ({ sessionId, keys, ttlMinutes }) => {
      try {
        const rateCheck = checkRateLimit();
        if (!rateCheck.allowed) {
          return errorResponse("Rate limit exceeded", rateCheck.warning!);
        }
        writeCallCount++;

        const claimKey = `agent/claims/${sessionId}`;
        const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

        await client.storeMemory(
          claimKey,
          JSON.stringify(keys),
          { sessionId, claimedAt: Date.now() },
          {
            tags: ["session-claim"],
            expiresAt,
            priority: 0,
          },
        );

        const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";

        return textResponse(
          JSON.stringify({
            sessionId,
            claimKey,
            keys,
            expiresAt: new Date(expiresAt).toISOString(),
            ttlMinutes,
            message: `Claimed ${keys.length} key(s) for session ${sessionId}. Expires in ${ttlMinutes} minutes.${rateWarn}`,
          }, null, 2),
        );
      } catch (error) {
        return errorResponse("Error creating session claim", error);
      }
    },
  );

  server.tool(
    "session_claims_check",
    "Check which memory keys are currently claimed by other sessions. Reports conflicts with your intended keys.",
    {
      keys: z.array(z.string()).describe("Memory keys you want to check for conflicts"),
      excludeSession: z
        .string()
        .optional()
        .describe("Exclude claims from this session ID"),
    },
    async ({ keys, excludeSession }) => {
      try {
        const result = await client.searchMemories("agent/claims/", 100, {
          tags: "session-claim",
        }) as { memories?: Array<{ key: string; content?: string; expiresAt?: unknown; metadata?: unknown }> };

        const claims = result.memories ?? [];
        const now = Date.now();
        const keysToCheck = new Set(keys);

        const activeClaims: Array<{
          sessionId: string;
          claimedKeys: string[];
          expiresAt: string;
          conflicts: string[];
        }> = [];

        for (const claim of claims) {
          // Check expiry
          const expiresAt = claim.expiresAt ? new Date(claim.expiresAt as string).getTime() : 0;
          if (expiresAt && expiresAt < now) continue;

          // Extract session ID from key
          const sessionId = claim.key.replace("agent/claims/", "");
          if (excludeSession && sessionId === excludeSession) continue;

          let claimedKeys: string[] = [];
          try {
            claimedKeys = JSON.parse(claim.content ?? "[]");
          } catch { continue; }

          const conflicts = claimedKeys.filter((k) => keysToCheck.has(k));

          activeClaims.push({
            sessionId,
            claimedKeys,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "unknown",
            conflicts,
          });
        }

        const allConflicts = activeClaims.flatMap((c) => c.conflicts);
        const uniqueConflicts = [...new Set(allConflicts)];

        return textResponse(
          JSON.stringify(
            {
              checkedKeys: keys,
              activeSessions: activeClaims.length,
              conflicts: uniqueConflicts,
              details: activeClaims.filter((c) => c.conflicts.length > 0),
              hint: uniqueConflicts.length > 0
                ? `${uniqueConflicts.length} key(s) claimed by other sessions: ${uniqueConflicts.join(", ")}. Coordinate before modifying.`
                : "No conflicts found. Safe to proceed.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error checking session claims", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMART ARCHIVAL SUGGESTIONS (Batch 2 – Feature 5)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_sunset",
    "Score memories for archival based on git history correlation, access patterns, feedback, and branch status. Returns sorted suggestions for cleanup.",
    {
      limit: z
        .number()
        .default(20)
        .describe("Maximum suggestions to return"),
    },
    async ({ limit }) => {
      try {
        const allMemories = await listAllMemories(client);

        // Get list of current git branches
        let currentBranches = new Set<string>();
        try {
          const { stdout } = await execFileAsync("git", ["branch", "--format=%(refname:short)"]);
          currentBranches = new Set(stdout.trim().split("\n").filter(Boolean));
        } catch { /* not in a git repo, skip branch scoring */ }

        // Get list of files currently tracked in git
        let trackedFiles = new Set<string>();
        try {
          const { stdout } = await execFileAsync("git", ["ls-files"]);
          trackedFiles = new Set(stdout.trim().split("\n").filter(Boolean));
        } catch { /* not in a git repo */ }

        const now = Date.now();
        const suggestions: Array<{
          key: string;
          score: number;
          reasons: string[];
          priority: number;
          lastAccessedAt: string | null;
        }> = [];

        for (const mem of allMemories) {
          if (mem.archivedAt) continue;

          let score = 0;
          const reasons: string[] = [];

          // Check branch tag — is the branch deleted?
          let tags: string[] = [];
          try { tags = JSON.parse(mem.tags as string ?? "[]"); } catch { /* skip */ }
          const branchTag = tags.find((t) => t.startsWith("branch:"));
          if (branchTag) {
            const branchName = branchTag.replace("branch:", "");
            if (currentBranches.size > 0 && !currentBranches.has(branchName)) {
              score += 40;
              reasons.push(`Branch "${branchName}" no longer exists`);
            }
          }

          // Check file references — are referenced files deleted?
          const content = mem.content ?? "";
          const fileRefs = content.match(/(?:^|\s)([\w./\-]+\.\w{1,10})/gm) ?? [];
          const missingFiles = fileRefs
            .map((f) => f.trim())
            .filter((f) => trackedFiles.size > 0 && !trackedFiles.has(f) && f.includes("/"));
          if (missingFiles.length > 0) {
            score += 30;
            reasons.push(`References ${missingFiles.length} file(s) no longer in repo`);
          }

          // Never accessed
          const lastAccess = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
          if (!lastAccess && mem.accessCount === 0) {
            score += 25;
            reasons.push("Never accessed");
          } else if (lastAccess) {
            const daysSince = (now - lastAccess) / 86_400_000;
            if (daysSince > 90) {
              score += 20;
              reasons.push(`Not accessed in ${Math.round(daysSince)} days`);
            }
          }

          // Negative feedback
          const helpful = mem.helpfulCount ?? 0;
          const unhelpful = mem.unhelpfulCount ?? 0;
          if (unhelpful > helpful && (helpful + unhelpful) >= 2) {
            score += 20;
            reasons.push(`Negative feedback (${helpful} helpful, ${unhelpful} unhelpful)`);
          }

          // Low priority + old
          const priority = mem.priority ?? 0;
          const createdAt = mem.createdAt ? new Date(mem.createdAt as string).getTime() : 0;
          if (priority === 0 && createdAt && (now - createdAt) / 86_400_000 > 60) {
            score += 10;
            reasons.push("Low priority and older than 60 days");
          }

          if (score > 0) {
            suggestions.push({
              key: mem.key,
              score,
              reasons,
              priority,
              lastAccessedAt: lastAccess ? new Date(lastAccess).toISOString() : null,
            });
          }
        }

        suggestions.sort((a, b) => b.score - a.score);
        const results = suggestions.slice(0, limit);

        return textResponse(
          JSON.stringify(
            {
              totalMemories: allMemories.length,
              suggestions: results.length,
              items: results,
              hint: results.length > 0
                ? `${results.length} memories are candidates for archival. Use memory_archive or memory_branch_merge to clean up.`
                : "No archival candidates found. Memory garden is well-maintained.",
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error generating archival suggestions", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CROSS-PROJECT ORG SEARCH (Batch 2 – Feature 6)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "memory_search_org",
    "Search memories across all projects in your organization. Useful for discovering knowledge from other projects.",
    {
      query: z.string().describe("Search query to match against keys and content"),
      limit: z
        .number()
        .default(50)
        .describe("Maximum results to return (max 200)"),
    },
    async ({ query, limit }) => {
      try {
        const result = await client.searchOrgMemories(query, Math.min(limit, 200));

        const projectsWithResults = Object.keys(result.grouped ?? {}).length;

        return textResponse(
          JSON.stringify(
            {
              ...result,
              projectsWithResults,
              hint: result.totalMatches > 0
                ? `Found ${result.totalMatches} matches across ${projectsWithResults} project(s) (searched ${result.projectsSearched}).`
                : `No matches for "${query}" across ${result.projectsSearched} project(s).`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error searching org memories", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CROSS-PROJECT CONTEXT DIFF (Batch 2 – Feature 7)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "org_context_diff",
    "Compare memories between two projects in the same org. Shows what's unique to each and what's shared (with content match status).",
    {
      projectA: z.string().describe("Slug of first project"),
      projectB: z.string().describe("Slug of second project"),
    },
    async ({ projectA, projectB }) => {
      try {
        const result = await client.orgContextDiff(projectA, projectB);

        const hints: string[] = [];
        if (result.stats.onlyInA > 0) {
          hints.push(`${result.stats.onlyInA} memories unique to ${projectA}`);
        }
        if (result.stats.onlyInB > 0) {
          hints.push(`${result.stats.onlyInB} memories unique to ${projectB}`);
        }
        if (result.stats.contentDiffers > 0) {
          hints.push(`${result.stats.contentDiffers} shared keys have different content — review for alignment`);
        }

        return textResponse(
          JSON.stringify(
            {
              ...result,
              hint: hints.length > 0
                ? hints.join(". ") + "."
                : `Projects ${projectA} and ${projectB} are fully aligned.`,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return errorResponse("Error computing org context diff", error);
      }
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BATCH OPERATIONS — combine multiple API calls in one round-trip
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  server.tool(
    "batch_operations",
    "Execute multiple memctl API operations in a single round-trip. Use this when you need to perform several independent reads or writes at once to reduce latency. Max 20 operations per batch.",
    {
      operations: z.array(
        z.object({
          method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
          path: z.string().describe("API path, e.g. /memories/my-key"),
          body: z.any().optional().describe("Request body for POST/PATCH"),
        }),
      ).min(1).max(20),
    },
    async ({ operations }) => {
      try {
        const result = await client.batch(operations);
        return textResponse(JSON.stringify(result, null, 2));
      } catch (error) {
        return errorResponse("Error executing batch operations", error);
      }
    },
  );
}
