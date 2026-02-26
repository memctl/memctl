import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import {
  textResponse,
  errorResponse,
  toFiniteLimitText,
  formatCapacityGuidance,
  matchGlob,
} from "../response.js";
import {
  buildAgentContextKey,
  buildBranchPlanKey,
  extractAgentContextEntries,
  getAllContextTypeInfo,
  getBranchInfo,
  listAllMemories,
  normalizeAgentContextId,
} from "../../agent-context.js";
import {
  classifySearchIntent,
  getIntentWeights,
} from "../../intent.js";

export function registerContextTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
) {
  server.tool(
    "context",
    "Agent context operations. Actions: bootstrap, bootstrap_compact, bootstrap_delta, functionality_get, functionality_set, functionality_delete, functionality_list, context_for, budget, compose, smart_retrieve, search_org, rules_evaluate, thread",
    {
      action: z
        .enum([
          "bootstrap",
          "bootstrap_compact",
          "bootstrap_delta",
          "functionality_get",
          "functionality_set",
          "functionality_delete",
          "functionality_list",
          "context_for",
          "budget",
          "compose",
          "smart_retrieve",
          "search_org",
          "rules_evaluate",
          "thread",
        ])
        .describe("Which operation to perform"),
      includeContent: z
        .boolean()
        .optional()
        .describe("[bootstrap,functionality_get] Include full content"),
      types: z
        .array(z.string())
        .optional()
        .describe("[bootstrap,context_for,budget] Filter by types"),
      branch: z
        .string()
        .optional()
        .describe("[bootstrap,rules_evaluate] Branch filter"),
      since: z
        .number()
        .optional()
        .describe("[bootstrap_delta] Timestamp for delta sync"),
      type: z
        .string()
        .optional()
        .describe(
          "[functionality_get,functionality_set,functionality_delete,functionality_list] Context type",
        ),
      id: z
        .string()
        .optional()
        .describe(
          "[functionality_get,functionality_set,functionality_delete] Item ID",
        ),
      title: z
        .string()
        .optional()
        .describe("[functionality_set] Human-readable title"),
      content: z
        .string()
        .optional()
        .describe("[functionality_set,check_duplicates] Content"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("[functionality_set] Metadata"),
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("[functionality_set] Priority"),
      tags: z.array(z.string()).optional().describe("[functionality_set] Tags"),
      followLinks: z
        .boolean()
        .optional()
        .describe("[functionality_get,smart_retrieve] Follow related links"),
      includeContentPreview: z
        .boolean()
        .optional()
        .describe("[functionality_list] Include preview"),
      limitPerType: z
        .number()
        .int()
        .optional()
        .describe("[functionality_list] Max per type"),
      filePaths: z
        .array(z.string())
        .optional()
        .describe("[context_for,rules_evaluate] File paths"),
      maxTokens: z
        .number()
        .int()
        .min(100)
        .max(200000)
        .optional()
        .describe("[budget,compose] Token budget"),
      includeKeys: z
        .array(z.string())
        .optional()
        .describe("[budget] Always-include keys"),
      task: z.string().optional().describe("[compose] Task description"),
      includeRelated: z.boolean().optional().describe("[compose] Follow links"),
      intent: z
        .string()
        .optional()
        .describe("[smart_retrieve] Natural language intent"),
      files: z
        .array(z.string())
        .optional()
        .describe("[smart_retrieve] Working files"),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("[smart_retrieve] Max results"),
      query: z.string().optional().describe("[search_org] Search query"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("[search_org] Max results"),
      taskType: z.string().optional().describe("[rules_evaluate] Task type"),
      sessionCount: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("[thread] Sessions to analyze"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "bootstrap":
            return handleBootstrap(client, params);
          case "bootstrap_compact":
            return handleBootstrapCompact(client);
          case "bootstrap_delta":
            return handleBootstrapDelta(client, params);
          case "functionality_get":
            return handleFunctionalityGet(client, params);
          case "functionality_set":
            return handleFunctionalitySet(client, params);
          case "functionality_delete":
            return handleFunctionalityDelete(client, params);
          case "functionality_list":
            return handleFunctionalityList(client, params);
          case "context_for":
            return handleContextFor(client, params);
          case "budget":
            return handleBudget(client, params);
          case "compose":
            return handleCompose(client, params);
          case "smart_retrieve":
            return handleSmartRetrieve(client, params);
          case "search_org":
            return handleSearchOrg(client, params);
          case "rules_evaluate":
            return handleRulesEvaluate(client, params);
          case "thread":
            return handleThread(client, params);
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in context.${params.action}`, error);
      }
    },
  );
}

async function handleBootstrap(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const includeContent = params.includeContent !== false;
  const types = params.types as string[] | undefined;
  const branch = params.branch as string | undefined;

  // Fire-and-forget cleanup with 500ms timeout
  const cleanupPromise = (async () => {
    try {
      // Check if auto-cleanup is disabled via project policy
      const POLICY_KEY = "agent/config/cleanup_policy";
      try {
        const policyMem = (await client.getMemory(POLICY_KEY)) as {
          memory?: { content?: string };
        };
        if (policyMem?.memory?.content) {
          const config = JSON.parse(policyMem.memory.content);
          if (config.autoCleanupOnBootstrap === false) return null;
        }
      } catch {
        /* policy not found, use defaults */
      }
      return await client.runLifecycle(
        [
          "cleanup_expired",
          "cleanup_session_logs",
          "auto_archive_unhealthy",
          "cleanup_expired_locks",
        ],
        { healthThreshold: 15 },
      );
    } catch {
      return null;
    }
  })();
  const cleanupTimeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 500),
  );
  const maintenancePromise = Promise.race([cleanupPromise, cleanupTimeout]);

  const [allMemories, branchInfo, capacity, allTypeInfo] = await Promise.all([
    listAllMemories(client),
    getBranchInfo(),
    client.getMemoryCapacity().catch(() => null),
    getAllContextTypeInfo(client),
  ]);

  const maintenance = await maintenancePromise;

  const entries = extractAgentContextEntries(allMemories);
  const allTypeSlugs = Object.keys(allTypeInfo);
  const selectedTypes = types ?? allTypeSlugs;
  const branchFilter =
    branch ??
    (branchInfo?.branch &&
    branchInfo.branch !== "main" &&
    branchInfo.branch !== "master"
      ? branchInfo.branch
      : null);
  const branchTag = branchFilter ? `branch:${branchFilter}` : null;

  const functionalityTypes = selectedTypes.map((type) => {
    const typeInfo = allTypeInfo[type];
    let typeEntries = entries.filter((e) => e.type === type);
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

  let branchPlan = null;
  if (branchInfo?.branch) {
    const planKey = buildBranchPlanKey(branchInfo.branch);
    branchPlan = await client.getMemory(planKey).catch(() => null);
  }

  const memoryStatus = capacity
    ? { ...capacity, guidance: formatCapacityGuidance(capacity) }
    : null;

  let orgDefaultsHint: string | undefined;
  if (entries.length === 0) {
    try {
      const orgDefaults = await client.listOrgDefaults();
      if (orgDefaults.defaults.length > 0)
        orgDefaultsHint = `This project has no memories yet. Your organization has ${orgDefaults.defaults.length} default memories available. Use org defaults_apply to populate this project.`;
    } catch {
      /* ignore */
    }
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
        maintenance: maintenance ?? null,
      },
      null,
      2,
    ),
  );
}

async function handleBootstrapCompact(client: ApiClient) {
  // Fire-and-forget cleanup with 500ms timeout
  const cleanupPromise = (async () => {
    try {
      const POLICY_KEY = "agent/config/cleanup_policy";
      try {
        const policyMem = (await client.getMemory(POLICY_KEY)) as {
          memory?: { content?: string };
        };
        if (policyMem?.memory?.content) {
          const config = JSON.parse(policyMem.memory.content);
          if (config.autoCleanupOnBootstrap === false) return null;
        }
      } catch {
        /* policy not found, use defaults */
      }
      return await client.runLifecycle(
        [
          "cleanup_expired",
          "cleanup_session_logs",
          "auto_archive_unhealthy",
          "cleanup_expired_locks",
        ],
        { healthThreshold: 15 },
      );
    } catch {
      return null;
    }
  })();
  const cleanupTimeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 500),
  );
  const maintenancePromise = Promise.race([cleanupPromise, cleanupTimeout]);

  const [allMemories, branchInfo, capacity, allTypeInfo] = await Promise.all([
    listAllMemories(client),
    getBranchInfo(),
    client.getMemoryCapacity().catch(() => null),
    getAllContextTypeInfo(client),
  ]);

  const maintenance = await maintenancePromise;

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
        hint: "Use context functionality_get to load full content.",
        types: types.filter((t) => t.count > 0),
        currentBranch: branchInfo,
        memoryStatus: capacity,
        totalEntries: entries.length,
        maintenance: maintenance ?? null,
      },
      null,
      2,
    ),
  );
}

async function handleBootstrapDelta(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const since = params.since as number;
  if (!since) return errorResponse("Missing param", "since required");
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
}

async function handleFunctionalityGet(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const type = params.type as string;
  const id = params.id as string | undefined;
  const includeContent = params.includeContent !== false;
  const followLinks = params.followLinks ?? false;
  if (!type) return errorResponse("Missing param", "type required");

  if (id) {
    const key = buildAgentContextKey(type, id);
    const memory = (await client.getMemory(key)) as Record<string, unknown>;
    let linked: unknown[] = [];
    if (followLinks) {
      const mem = memory?.memory as Record<string, unknown> | undefined;
      const relatedKeysRaw =
        typeof mem?.relatedKeys === "string" ? mem.relatedKeys : null;
      if (relatedKeysRaw) {
        try {
          const relatedKeys = JSON.parse(relatedKeysRaw) as string[];
          if (relatedKeys.length > 0) {
            const bulk = await client.bulkGetMemories(relatedKeys);
            linked = Object.values(bulk.memories);
          }
        } catch {
          /* ignore */
        }
      }
    }
    return textResponse(
      JSON.stringify(
        followLinks ? { ...memory, linkedMemories: linked } : memory,
        null,
        2,
      ),
    );
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
}

async function handleFunctionalitySet(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const type = params.type as string;
  const id = params.id as string;
  const content = params.content as string;
  if (!type || !id || !content)
    return errorResponse("Missing params", "type, id, and content required");

  const normalizedId = normalizeAgentContextId(id);
  if (!normalizedId)
    return errorResponse("Error", "ID is empty after normalization.");

  const key = buildAgentContextKey(type, normalizedId);
  await client.storeMemory(
    key,
    content,
    {
      ...(params.metadata as Record<string, unknown> | undefined),
      scope: "agent_functionality",
      type,
      id: normalizedId,
      title: (params.title as string) ?? normalizedId,
      updatedByTool: "context.functionality_set",
      updatedAt: new Date().toISOString(),
    },
    {
      priority: params.priority as number | undefined,
      tags: params.tags as string[] | undefined,
    },
  );

  const capacity = await client.getMemoryCapacity().catch(() => null);
  const message = capacity
    ? `Functionality saved: ${key} (project: ${capacity.used}/${toFiniteLimitText(capacity.limit)})`
    : `Functionality saved: ${key}`;
  return textResponse(message);
}

async function handleFunctionalityDelete(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const type = params.type as string;
  const id = params.id as string;
  if (!type || !id)
    return errorResponse("Missing params", "type and id required");
  const key = buildAgentContextKey(type, id);
  await client.deleteMemory(key);
  return textResponse(`Functionality deleted: ${key}`);
}

async function handleFunctionalityList(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const type = params.type as string | undefined;
  const includeContentPreview = params.includeContentPreview ?? false;
  const limitPerType = (params.limitPerType as number) ?? 20;

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
    ? { ...capacity, guidance: formatCapacityGuidance(capacity) }
    : null;
  return textResponse(
    JSON.stringify(
      { functionalityTypes: result, currentBranch: branchInfo, memoryStatus },
      null,
      2,
    ),
  );
}

async function handleContextFor(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const filePaths = params.filePaths as string[];
  if (!filePaths?.length)
    return errorResponse("Missing param", "filePaths required");
  const types = params.types as string[] | undefined;

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

  const searchTerms: string[] = [];
  for (const fp of filePaths) {
    searchTerms.push(...fp.split("/").filter(Boolean));
    const ext = fp.split(".").pop();
    if (ext) searchTerms.push(ext);
  }
  const searchTermsLower = [
    ...new Set(searchTerms.map((t) => t.toLowerCase())),
  ];

  const scored = entries
    .filter((e) => relevantTypes.includes(e.type))
    .map((entry) => {
      const searchableText =
        `${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
      let score = entry.priority;
      for (const term of searchTermsLower) {
        if (searchableText.includes(term)) score += 10;
      }
      for (const fp of filePaths) {
        if (searchableText.includes(fp.toLowerCase())) score += 50;
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
}

async function handleBudget(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const maxTokens = params.maxTokens as number;
  if (!maxTokens) return errorResponse("Missing param", "maxTokens required");
  const types = params.types as string[] | undefined;
  const includeKeys = params.includeKeys as string[] | undefined;

  const allMemories = await listAllMemories(client);
  const entries = extractAgentContextEntries(allMemories);
  const allTypeInfo = await getAllContextTypeInfo(client);
  const selectedTypes = types ?? Object.keys(allTypeInfo);

  const mustInclude = includeKeys
    ? entries.filter((e) => includeKeys.includes(e.key))
    : [];
  const candidates = entries
    .filter((e) => selectedTypes.includes(e.type))
    .filter((e) => !includeKeys?.includes(e.key));

  const CHARS_PER_TOKEN = 4;
  let budgetRemaining = maxTokens * CHARS_PER_TOKEN;
  const now = Date.now();

  const scored = candidates.map((entry) => {
    const charLen = entry.content.length;
    const tokenEst = Math.ceil(charLen / CHARS_PER_TOKEN);
    const mem = allMemories.find((m) => m.key === entry.key);
    const accessCount = mem?.accessCount ?? 0;
    const helpful = (mem?.helpfulCount ?? 0) - (mem?.unhelpfulCount ?? 0);
    const lastAccess = mem?.lastAccessedAt
      ? new Date(mem.lastAccessedAt as string).getTime()
      : 0;
    const daysSinceAccess = lastAccess ? (now - lastAccess) / 86_400_000 : 999;
    const isPinned = mem?.pinnedAt ? 1 : 0;
    const totalValue =
      entry.priority * 2 +
      Math.min(20, accessCount * 2) +
      Math.max(0, helpful * 3) +
      Math.max(0, 20 - daysSinceAccess / 3) +
      isPinned * 30;
    const efficiency = tokenEst > 0 ? totalValue / tokenEst : 0;
    return { entry, charLen, tokenEst, totalValue, efficiency };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.efficiency - a.efficiency) > 0.01)
      return b.efficiency - a.efficiency;
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
  for (const entry of mustInclude) {
    const charLen = entry.content.length;
    selected.push({
      type: entry.type,
      id: entry.id,
      key: entry.key,
      title: entry.title,
      priority: entry.priority,
      content: entry.content,
      tokenEstimate: Math.ceil(charLen / CHARS_PER_TOKEN),
    });
    budgetRemaining -= charLen;
  }
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
}

async function handleCompose(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const task = params.task as string;
  if (!task) return errorResponse("Missing param", "task required");
  const maxTokens = (params.maxTokens as number) ?? 8000;
  const includeRelated = params.includeRelated !== false;

  const allMemories = await listAllMemories(client);
  const entries = extractAgentContextEntries(allMemories);
  const taskWords = new Set(
    task
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

  const scored = entries.map((entry) => {
    const searchableText =
      `${entry.type} ${entry.title} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    let score = 0;
    const mem = allMemories.find((m) => m.key === entry.key);
    if (mem?.pinnedAt) score += 200;
    score += entry.priority;
    for (const word of taskWords) {
      if (searchableText.includes(word)) score += 15;
    }
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
    if (entry.content.length > budgetRemaining || selectedKeys.has(entry.key))
      continue;
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

    if (includeRelated && mem?.relatedKeys) {
      try {
        const relKeys = JSON.parse(
          typeof mem.relatedKeys === "string" ? mem.relatedKeys : "[]",
        ) as string[];
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
      } catch {
        /* ignore */
      }
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
}

async function handleSmartRetrieve(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const intent = params.intent as string;
  if (!intent) return errorResponse("Missing param", "intent required");
  const files = params.files as string[] | undefined;
  const maxResults = (params.maxResults as number) ?? 5;
  const followLinks = params.followLinks !== false;

  const classification = classifySearchIntent(intent);
  const weights = getIntentWeights(classification.intent);

  const allMemories = await listAllMemories(client);
  const now = Date.now();
  const intentWords =
    classification.extractedTerms.length > 0
      ? classification.extractedTerms.map((t) => t.toLowerCase())
      : intent
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2);
  const filePatterns = (files ?? []).map((f) => f.toLowerCase());

  const scored = allMemories.map((mem) => {
    const content =
      `${mem.key} ${mem.content ?? ""} ${mem.tags ?? ""}`.toLowerCase();
    let score = 0;

    // Keyword matching, boosted by ftsBoost
    const matchedWords = intentWords.filter((w) => content.includes(w));
    score += matchedWords.length * 10 * weights.ftsBoost;

    for (const fp of filePatterns) {
      for (const part of fp.split("/").filter(Boolean)) {
        if (content.includes(part.toLowerCase())) score += 5;
      }
      if (content.includes(fp)) score += 15;
    }

    // Priority, boosted by priorityBoost
    score += (mem.priority ?? 0) * 0.3 * weights.priorityBoost;
    if (mem.pinnedAt) score += 10;
    score += Math.min(10, (mem.accessCount ?? 0) * 0.5);

    // Recency, boosted by recencyBoost
    const lastAccess = mem.lastAccessedAt
      ? new Date(mem.lastAccessedAt as string).getTime()
      : 0;
    if (lastAccess)
      score +=
        Math.max(0, 5 - (now - lastAccess) / 86_400_000 / 7) *
        weights.recencyBoost;

    score += ((mem.helpfulCount ?? 0) - (mem.unhelpfulCount ?? 0)) * 2;

    // Graph boost: memories with relatedKeys
    if (weights.graphBoost > 0 && mem.relatedKeys) {
      try {
        const relKeys = JSON.parse(mem.relatedKeys as string) as string[];
        if (relKeys.length > 0) score += relKeys.length * weights.graphBoost;
      } catch {
        /* ignore */
      }
    }

    // Boost memories whose key contains a suggested type path segment
    if (classification.suggestedTypes) {
      for (const st of classification.suggestedTypes) {
        if (mem.key.includes(st)) score += 8;
      }
    }

    return { mem, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxResults).filter((s) => s.score > 0);

  const linkedKeys = new Set<string>();
  if (followLinks) {
    for (const { mem } of top) {
      if (mem.relatedKeys) {
        try {
          (JSON.parse(mem.relatedKeys as string) as string[]).forEach((k) =>
            linkedKeys.add(k),
          );
        } catch {
          /* ignore */
        }
      }
    }
    for (const { mem } of top) linkedKeys.delete(mem.key);
  }

  let linked: Array<Record<string, unknown>> = [];
  if (linkedKeys.size > 0) {
    try {
      const bulk = await client.bulkGetMemories([...linkedKeys]);
      linked = Object.values(bulk.memories) as Array<Record<string, unknown>>;
    } catch {
      /* ignore */
    }
  }

  return textResponse(
    JSON.stringify(
      {
        intent,
        _searchIntent: classification.intent,
        _confidence: classification.confidence,
        resultsCount: top.length,
        linkedCount: linked.length,
        results: top.map(({ mem, score }) => ({
          key: mem.key,
          score: Math.round(score * 10) / 10,
          content: mem.content,
          priority: mem.priority,
          tags: mem.tags,
        })),
        linkedMemories:
          linked.length > 0
            ? linked.map((m) => ({ key: m.key, content: m.content }))
            : undefined,
      },
      null,
      2,
    ),
  );
}

async function handleSearchOrg(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const query = params.query as string;
  if (!query) return errorResponse("Missing param", "query required");
  const limit = (params.limit as number) ?? 50;
  const result = await client.searchOrgMemories(query, Math.min(limit, 200));
  const projectsWithResults = Object.keys(result.grouped ?? {}).length;
  return textResponse(
    JSON.stringify(
      {
        ...result,
        projectsWithResults,
        hint:
          result.totalMatches > 0
            ? `Found ${result.totalMatches} matches across ${projectsWithResults} project(s).`
            : `No matches for "${query}".`,
      },
      null,
      2,
    ),
  );
}

async function handleRulesEvaluate(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const filePaths = params.filePaths as string[] | undefined;
  const taskType = params.taskType as string | undefined;
  const branchInfo = await getBranchInfo();
  const currentBranch = (params.branch as string) ?? branchInfo?.branch ?? "";
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
    if (cond.filePatterns && filePaths) {
      for (const pattern of cond.filePatterns) {
        if (filePaths.some((fp) => matchGlob(fp, pattern)))
          matchedConditions.push(`file:${pattern}`);
      }
    }
    if (cond.branchPatterns && currentBranch) {
      for (const pattern of cond.branchPatterns) {
        if (matchGlob(currentBranch, pattern))
          matchedConditions.push(`branch:${pattern}`);
      }
    }
    if (cond.taskTypes && taskType) {
      if (cond.taskTypes.includes(taskType))
        matchedConditions.push(`task:${taskType}`);
    }
    if (matchedConditions.length > 0)
      matched.push({
        type: entry.type,
        id: entry.id,
        title: entry.title,
        content: entry.content,
        matchedConditions,
      });
  }
  if (matched.length === 0)
    return textResponse("No conditional context rules matched.");
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
}

async function handleThread(
  client: ApiClient,
  params: Record<string, unknown>,
) {
  const sessionCount = (params.sessionCount as number) ?? 3;
  const sessions = await client.getSessionLogs(sessionCount);
  const logs = sessions.sessionLogs ?? [];

  const hotKeys: Record<
    string,
    { reads: number; writes: number; lastSession: string }
  > = {};
  for (const log of logs) {
    const read = log.keysRead
      ? (JSON.parse(log.keysRead as string) as string[])
      : [];
    const written = log.keysWritten
      ? (JSON.parse(log.keysWritten as string) as string[])
      : [];
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
        hint:
          activelyEdited.length > 0
            ? `${activelyEdited.length} memories were being actively edited.`
            : "No recent edits.",
      },
      null,
      2,
    ),
  );
}
