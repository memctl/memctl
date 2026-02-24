import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import {
  textResponse,
  errorResponse,
  hasMemoryFullError,
  formatCapacityGuidance,
} from "../response.js";
import { getBranchInfo, listAllMemories } from "../../agent-context.js";

export function registerMemoryTool(
  server: McpServer,
  client: ApiClient,
  rl: RateLimitState,
) {
  server.tool(
    "memory",
    "Core memory CRUD. Actions: store, get, search, list, delete, update, pin, archive, bulk_get, store_safe, capacity",
    {
      action: z
        .enum([
          "store",
          "get",
          "search",
          "list",
          "delete",
          "update",
          "pin",
          "archive",
          "bulk_get",
          "store_safe",
          "capacity",
        ])
        .describe("Which operation to perform"),
      key: z
        .string()
        .optional()
        .describe(
          "[store,get,delete,update,pin,archive,store_safe] Memory key",
        ),
      content: z
        .string()
        .optional()
        .describe("[store,update,store_safe] Content to store"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("[store,update,store_safe] Optional metadata object"),
      scope: z
        .enum(["project", "shared"])
        .optional()
        .describe("[store] 'project' (default) or 'shared' for org-wide"),
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("[store,update,store_safe] Priority 0-100"),
      tags: z
        .array(z.string())
        .optional()
        .describe("[store,update,store_safe] Tags for categorization"),
      expiresAt: z
        .number()
        .optional()
        .describe("[store] Unix timestamp for expiration"),
      ttl: z
        .enum(["session", "pr", "sprint", "permanent"])
        .optional()
        .describe("[store] Named TTL preset"),
      dedupAction: z
        .enum(["warn", "skip", "merge"])
        .optional()
        .describe("[store] Dedup strategy"),
      autoBranch: z
        .boolean()
        .optional()
        .describe("[store] Auto-append branch tag"),
      includeHints: z
        .boolean()
        .optional()
        .describe("[get] Include contextual hints"),
      query: z.string().optional().describe("[search] Search query"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("[search,list] Max results"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("[list] Pagination offset"),
      sort: z
        .enum(["updated", "priority", "created"])
        .optional()
        .describe("[search,list] Sort order"),
      includeArchived: z
        .boolean()
        .optional()
        .describe("[search,list] Include archived"),
      keys: z.array(z.string()).optional().describe("[bulk_get] Array of keys"),
      pin: z.boolean().optional().describe("[pin] true=pin, false=unpin"),
      archiveFlag: z
        .boolean()
        .optional()
        .describe("[archive] true=archive, false=unarchive"),
      ifUnmodifiedSince: z
        .number()
        .optional()
        .describe("[store_safe] Concurrency check timestamp"),
      onConflict: z
        .enum(["reject", "last_write_wins", "append", "return_both"])
        .optional()
        .describe("[store_safe] Conflict resolution"),
    },
    async (params) => {
      switch (params.action) {
        case "store":
          return handleStore(client, rl, params);
        case "get":
          return handleGet(client, params);
        case "search":
          return handleSearch(client, params);
        case "list":
          return handleList(client, params);
        case "delete":
          return handleDelete(client, rl, params);
        case "update":
          return handleUpdate(client, rl, params);
        case "pin":
          return handlePin(client, params);
        case "archive":
          return handleArchive(client, params);
        case "bulk_get":
          return handleBulkGet(client, params);
        case "store_safe":
          return handleStoreSafe(client, params);
        case "capacity":
          return handleCapacity(client);
        default:
          return errorResponse("Unknown action", params.action);
      }
    },
  );
}

async function handleStore(
  client: ApiClient,
  rl: RateLimitState,
  params: Record<string, unknown>,
) {
  try {
    const rateCheck = rl.checkRateLimit();
    if (!rateCheck.allowed)
      return errorResponse("Rate limit exceeded", rateCheck.warning!);
    rl.incrementWriteCount();

    const key = params.key as string;
    const content = params.content as string;
    const metadata = params.metadata as Record<string, unknown> | undefined;
    const scope = (params.scope as string) ?? "project";
    const priority = params.priority as number | undefined;
    const tags = params.tags as string[] | undefined;
    const expiresAt = params.expiresAt as number | undefined;
    const ttl = params.ttl as string | undefined;
    const dedupAction = (params.dedupAction as string) ?? "warn";
    const autoBranch = params.autoBranch !== false;

    if (!key || !content)
      return errorResponse(
        "Missing required params",
        "key and content are required for store",
      );

    let resolvedTags = tags ?? [];
    if (autoBranch) {
      try {
        const bi = await getBranchInfo();
        if (bi?.branch && bi.branch !== "main" && bi.branch !== "master") {
          const branchTag = `branch:${bi.branch}`;
          if (!resolvedTags.includes(branchTag))
            resolvedTags = [...resolvedTags, branchTag];
        }
      } catch {
        /* ignore */
      }
    }

    let resolvedExpiry = expiresAt;
    if (!resolvedExpiry && ttl && ttl !== "permanent") {
      const now = Date.now();
      const TTL_MAP: Record<string, number> = {
        session: 24 * 60 * 60 * 1000,
        pr: 7 * 24 * 60 * 60 * 1000,
        sprint: 14 * 24 * 60 * 60 * 1000,
      };
      resolvedExpiry = now + (TTL_MAP[ttl] ?? 0);
    }

    let dedupWarning = "";
    try {
      const similar = await client.findSimilar(content, key, 0.7);
      if (similar.similar.length > 0) {
        const top = similar.similar[0]!;
        if (dedupAction === "skip") {
          return textResponse(
            `Skipped: similar memory "${top.key}" already exists (${Math.round(top.similarity * 100)}% match).`,
          );
        }
        if (dedupAction === "merge") {
          const existing = (await client.getMemory(top.key)) as Record<
            string,
            unknown
          >;
          const existingMem = existing?.memory as
            | Record<string, unknown>
            | undefined;
          const existingContent =
            typeof existingMem?.content === "string" ? existingMem.content : "";
          const merged = `${existingContent}\n\n---\n\n${content}`;
          await client.storeMemory(top.key, merged, metadata, {
            scope,
            priority,
            tags: resolvedTags.length > 0 ? resolvedTags : undefined,
            expiresAt: resolvedExpiry,
          });
          return textResponse(
            `Merged into existing memory "${top.key}" (${Math.round(top.similarity * 100)}% match).`,
          );
        }
        dedupWarning = ` Warning: Similar memory: "${top.key}" (${Math.round(top.similarity * 100)}% match).`;
      }
    } catch {
      /* ignore */
    }

    // Auto-eviction: if near capacity, archive lowest-health non-pinned memories
    let evictionMsg = "";
    try {
      const cap = await client.getMemoryCapacity();
      if (cap.isFull) {
        const health = await client.getHealthScores(200);
        const evictable = health.memories
          .filter((m) => !m.isPinned)
          .slice(0, 3);
        if (evictable.length > 0) {
          const evictKeys = evictable.map((m) => m.key);
          await client.batchMutate(evictKeys, "archive");
          evictionMsg = ` Auto-archived ${evictKeys.length} low-health memories to free space: ${evictKeys.join(", ")}.`;
        }
      }
    } catch {
      /* ignore eviction errors */
    }

    await client.storeMemory(key, content, metadata, {
      scope,
      priority,
      tags: resolvedTags.length > 0 ? resolvedTags : undefined,
      expiresAt: resolvedExpiry,
    });
    const scopeMsg = scope === "shared" ? " [shared across org]" : "";
    const ttlMsg = ttl ? ` [ttl: ${ttl}]` : "";
    const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
    const writeWarn = rl.getSessionWriteWarning() ?? "";
    return textResponse(
      `Memory stored with key: ${key}${scopeMsg}${ttlMsg}${dedupWarning}${evictionMsg}${rateWarn}${writeWarn}`,
    );
  } catch (error) {
    if (hasMemoryFullError(error)) {
      return errorResponse(
        "Error storing memory",
        `${error instanceof Error ? error.message : String(error)} Use memory delete or archive to free space.`,
      );
    }
    return errorResponse("Error storing memory", error);
  }
}

async function handleGet(client: ApiClient, params: Record<string, unknown>) {
  try {
    const key = params.key as string;
    if (!key)
      return errorResponse("Missing required param", "key is required for get");

    const includeHints = params.includeHints !== false;
    const memory = (await client.getMemory(key)) as {
      memory?: Record<string, unknown>;
    };
    client.prefetchCoAccessed(key);

    if (includeHints && memory?.memory) {
      const mem = memory.memory;
      const hints: string[] = [];
      const now = Date.now();

      const updatedAt = mem.updatedAt
        ? new Date(mem.updatedAt as string).getTime()
        : 0;
      if (updatedAt) {
        const daysSinceUpdate = (now - updatedAt) / 86_400_000;
        if (daysSinceUpdate > 60)
          hints.push(
            `Stale: not updated in ${Math.round(daysSinceUpdate)} days`,
          );
        else if (daysSinceUpdate > 30)
          hints.push(
            `Aging: last updated ${Math.round(daysSinceUpdate)} days ago`,
          );
      }

      const lastAccessed = mem.lastAccessedAt
        ? new Date(mem.lastAccessedAt as string).getTime()
        : 0;
      if (lastAccessed) {
        const daysSinceAccess = (now - lastAccessed) / 86_400_000;
        if (daysSinceAccess > 30)
          hints.push(
            `Rarely accessed: last read ${Math.round(daysSinceAccess)} days ago`,
          );
      } else {
        hints.push("Never accessed before");
      }

      const helpful = (mem.helpfulCount as number) ?? 0;
      const unhelpful = (mem.unhelpfulCount as number) ?? 0;
      if (helpful + unhelpful > 0) {
        if (unhelpful > helpful)
          hints.push(
            `Negative feedback: ${helpful} helpful, ${unhelpful} unhelpful`,
          );
        else if (helpful > 0)
          hints.push(
            `Positive feedback: ${helpful} helpful, ${unhelpful} unhelpful`,
          );
      }

      if (mem.pinnedAt) hints.push("Pinned: always included in bootstrap");

      if (mem.expiresAt) {
        const expiresAt = new Date(mem.expiresAt as string).getTime();
        const daysUntilExpiry = (expiresAt - now) / 86_400_000;
        if (daysUntilExpiry < 0) hints.push("Expired");
        else if (daysUntilExpiry < 3)
          hints.push(
            `Expiring soon: ${Math.round(daysUntilExpiry * 24)} hours left`,
          );
      }

      const contentLen =
        typeof mem.content === "string" ? mem.content.length : 0;
      if (contentLen > 8000)
        hints.push(`Large memory: ~${Math.ceil(contentLen / 4)} tokens`);

      if (mem.relatedKeys) {
        try {
          const relKeys = JSON.parse(mem.relatedKeys as string) as string[];
          if (relKeys.length > 0)
            hints.push(`Linked to ${relKeys.length} other memories`);
        } catch {
          /* ignore */
        }
      }

      return textResponse(JSON.stringify({ ...memory, hints }, null, 2));
    }

    return textResponse(JSON.stringify(memory, null, 2));
  } catch (error) {
    return errorResponse("Error retrieving memory", error);
  }
}

async function handleSearch(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  try {
    const query = params.query as string;
    if (!query)
      return errorResponse(
        "Missing required param",
        "query is required for search",
      );

    const results = await client.searchMemories(
      query,
      (params.limit as number) ?? 20,
      {
        tags: params.tags as string | undefined,
        sort: params.sort as string | undefined,
        includeArchived: (params.includeArchived as boolean) ?? false,
      },
    );
    return textResponse(JSON.stringify(results, null, 2));
  } catch (error) {
    return errorResponse("Error searching memories", error);
  }
}

async function handleList(client: ApiClient, params: Record<string, unknown>) {
  try {
    const results = await client.listMemories(
      (params.limit as number) ?? 100,
      (params.offset as number) ?? 0,
      {
        sort: params.sort as string | undefined,
        tags: params.tags as string | undefined,
        includeArchived: (params.includeArchived as boolean) ?? false,
      },
    );
    return textResponse(JSON.stringify(results, null, 2));
  } catch (error) {
    return errorResponse("Error listing memories", error);
  }
}

async function handleDelete(
  client: ApiClient,
  rl: RateLimitState,
  params: Record<string, unknown>,
) {
  try {
    const rateCheck = rl.checkRateLimit();
    if (!rateCheck.allowed)
      return errorResponse("Rate limit exceeded", rateCheck.warning!);
    rl.incrementWriteCount();

    const key = params.key as string;
    if (!key)
      return errorResponse(
        "Missing required param",
        "key is required for delete",
      );

    await client.deleteMemory(key);
    const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
    return textResponse(`Memory deleted: ${key}${rateWarn}`);
  } catch (error) {
    return errorResponse("Error deleting memory", error);
  }
}

async function handleUpdate(
  client: ApiClient,
  rl: RateLimitState,
  params: Record<string, unknown>,
) {
  try {
    const rateCheck = rl.checkRateLimit();
    if (!rateCheck.allowed)
      return errorResponse("Rate limit exceeded", rateCheck.warning!);
    rl.incrementWriteCount();

    const key = params.key as string;
    if (!key)
      return errorResponse(
        "Missing required param",
        "key is required for update",
      );

    await client.updateMemory(
      key,
      params.content as string | undefined,
      params.metadata as Record<string, unknown> | undefined,
      {
        priority: params.priority as number | undefined,
        tags: params.tags as string[] | undefined,
      },
    );

    let impactWarning = "";
    try {
      const allMemories = await listAllMemories(client);
      const impacted = allMemories.filter((m) => {
        if (m.key === key) return false;
        const c = (m.content ?? "").toLowerCase();
        const rk = (m.relatedKeys ?? "").toLowerCase();
        const meta =
          typeof m.metadata === "string" ? m.metadata.toLowerCase() : "";
        const keyLower = key.toLowerCase();
        return (
          c.includes(keyLower) ||
          rk.includes(keyLower) ||
          meta.includes(keyLower)
        );
      });
      if (impacted.length > 0) {
        impactWarning = ` Warning: ${impacted.length} other memories reference "${key}": ${impacted
          .slice(0, 5)
          .map((m) => m.key)
          .join(", ")}${impacted.length > 5 ? "..." : ""}.`;
      }
    } catch {
      /* ignore */
    }

    const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
    const writeWarn = rl.getSessionWriteWarning() ?? "";
    return textResponse(
      `Memory updated: ${key}${impactWarning}${rateWarn}${writeWarn}`,
    );
  } catch (error) {
    return errorResponse("Error updating memory", error);
  }
}

async function handlePin(client: ApiClient, params: Record<string, unknown>) {
  try {
    const key = params.key as string;
    if (!key)
      return errorResponse("Missing required param", "key is required for pin");
    const pin = params.pin as boolean;
    if (pin === undefined)
      return errorResponse("Missing required param", "pin is required");

    const result = await client.pinMemory(key, pin);
    return textResponse(result.message);
  } catch (error) {
    return errorResponse("Error pinning memory", error);
  }
}

async function handleArchive(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  try {
    const key = params.key as string;
    if (!key)
      return errorResponse(
        "Missing required param",
        "key is required for archive",
      );
    const archive = params.archiveFlag as boolean;
    if (archive === undefined)
      return errorResponse("Missing required param", "archiveFlag is required");

    await client.archiveMemory(key, archive);
    return textResponse(
      `Memory ${archive ? "archived" : "unarchived"}: ${key}`,
    );
  } catch (error) {
    return errorResponse("Error archiving memory", error);
  }
}

async function handleBulkGet(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  try {
    const keys = params.keys as string[];
    if (!keys || keys.length === 0)
      return errorResponse(
        "Missing required param",
        "keys array is required for bulk_get",
      );

    const result = await client.bulkGetMemories(keys);
    return textResponse(JSON.stringify(result, null, 2));
  } catch (error) {
    return errorResponse("Error bulk-retrieving memories", error);
  }
}

async function handleStoreSafe(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  try {
    const key = params.key as string;
    const content = params.content as string;
    const ifUnmodifiedSince = params.ifUnmodifiedSince as number;
    if (!key || !content)
      return errorResponse(
        "Missing required params",
        "key and content are required for store_safe",
      );
    if (ifUnmodifiedSince === undefined)
      return errorResponse(
        "Missing required param",
        "ifUnmodifiedSince is required for store_safe",
      );

    const onConflict = (params.onConflict as string) ?? "reject";
    const metadata = params.metadata as Record<string, unknown> | undefined;
    const priority = params.priority as number | undefined;
    const tags = params.tags as string[] | undefined;

    let current: Record<string, unknown> | null = null;
    try {
      current = (await client.getMemory(key)) as Record<string, unknown>;
    } catch {
      /* ignore */
    }

    const mem = current?.memory as Record<string, unknown> | undefined;
    if (mem?.updatedAt) {
      const currentUpdated =
        typeof mem.updatedAt === "string"
          ? new Date(mem.updatedAt).getTime()
          : typeof mem.updatedAt === "number"
            ? mem.updatedAt
            : 0;

      if (currentUpdated > ifUnmodifiedSince) {
        const memContent = typeof mem.content === "string" ? mem.content : "";

        if (onConflict === "last_write_wins") {
          await client.storeMemory(key, content, metadata, { priority, tags });
          return textResponse(
            `Memory stored with key: ${key} (conflict resolved: last_write_wins)`,
          );
        }
        if (onConflict === "append") {
          const merged = `${memContent}\n\n---\n\n${content}`;
          await client.storeMemory(key, merged, metadata, { priority, tags });
          return textResponse(
            `Memory stored with key: ${key} (conflict resolved: append)`,
          );
        }
        if (onConflict === "return_both") {
          return textResponse(
            JSON.stringify(
              {
                conflict: true,
                key,
                strategy: "return_both",
                message:
                  "Memory was modified. Both versions returned for manual merge.",
                remoteVersion: memContent,
                localVersion: content,
                remoteUpdatedAt: mem.updatedAt,
                localTimestamp: new Date(ifUnmodifiedSince).toISOString(),
              },
              null,
              2,
            ),
          );
        }

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
              suggestion:
                "Read the current version, merge changes, then store again.",
            },
            null,
            2,
          ),
        );
      }
    }

    await client.storeMemory(key, content, metadata, { priority, tags });
    return textResponse(`Memory stored with key: ${key} (no conflict)`);
  } catch (error) {
    return errorResponse("Error in safe store", error);
  }
}

async function handleCapacity(client: ApiClient) {
  try {
    const capacity = await client.getMemoryCapacity();
    return textResponse(
      JSON.stringify(
        { ...capacity, guidance: formatCapacityGuidance(capacity) },
        null,
        2,
      ),
    );
  } catch (error) {
    return errorResponse("Error getting memory capacity", error);
  }
}
