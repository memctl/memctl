/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock agent-context before any handler imports ──────────────────────
vi.mock("../agent-context", () => ({
  getBranchInfo: vi.fn().mockResolvedValue({ branch: "main" }),
  buildBranchPlanKey: vi.fn((b: string) => `agent/context/branch_plan/${b}`),
  buildAgentContextKey: vi.fn(
    (t: string, id: string) => `agent/context/${t}/${id}`,
  ),
  extractAgentContextEntries: vi.fn(() => []),
  getAllContextTypeInfo: vi.fn().mockResolvedValue({}),
  getAllContextTypeSlugs: vi.fn().mockResolvedValue([]),
  getCustomContextTypes: vi.fn().mockResolvedValue([]),
  invalidateCustomTypesCache: vi.fn(),
  listAllMemories: vi.fn().mockResolvedValue([]),
  normalizeAgentContextId: vi.fn((id: string) => id),
  parseAgentsMd: vi.fn(() => []),
  AGENT_CONTEXT_TYPE_INFO: {},
  BUILTIN_AGENT_CONTEXT_TYPES: [],
}));

// ── Mock child_process (used by session handler for git extraction) ────
vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb?: Function) => {
      if (cb) cb(null, { stdout: "", stderr: "" });
    },
  ),
}));

// ── Helpers ────────────────────────────────────────────────────────────

/** Creates a mock McpServer that captures tool registrations. */
function createMockServer() {
  const tools: Record<
    string,
    { description: string; schema: unknown; handler: Function }
  > = {};
  return {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: Function,
    ) => {
      tools[name] = { description, schema, handler };
    },
    tools,
  };
}

/** Creates a mock ApiClient with vi.fn() stubs for every method the handlers call. */
function createMockClient() {
  return {
    storeMemory: vi.fn().mockResolvedValue({ memory: { key: "test" } }),
    getMemory: vi
      .fn()
      .mockResolvedValue({ memory: { key: "test", content: "data" } }),
    searchMemories: vi.fn().mockResolvedValue({ memories: [] }),
    listMemories: vi.fn().mockResolvedValue({ memories: [] }),
    deleteMemory: vi.fn().mockResolvedValue({ deleted: true }),
    updateMemory: vi.fn().mockResolvedValue({ memory: { key: "test" } }),
    pinMemory: vi
      .fn()
      .mockResolvedValue({ key: "test", pinned: true, message: "Pinned" }),
    archiveMemory: vi.fn().mockResolvedValue({ archived: true }),
    bulkGetMemories: vi
      .fn()
      .mockResolvedValue({ memories: {}, found: 0, requested: 0 }),
    getMemoryCapacity: vi.fn().mockResolvedValue({
      used: 10,
      limit: 100,
      isFull: false,
      isApproaching: false,
    }),
    findSimilar: vi.fn().mockResolvedValue({ similar: [] }),
    prefetchCoAccessed: vi.fn(),
    getSessionLogs: vi.fn().mockResolvedValue({ sessionLogs: [] }),
    upsertSessionLog: vi.fn().mockResolvedValue({}),
    createContextType: vi.fn().mockResolvedValue({}),
    deleteContextType: vi.fn().mockResolvedValue({}),
    listContextTypes: vi.fn().mockResolvedValue({ contextTypes: [] }),
    feedbackMemory: vi.fn().mockResolvedValue({
      key: "k",
      feedback: "helpful",
      helpfulCount: 1,
      unhelpfulCount: 0,
    }),
    linkMemories: vi.fn().mockResolvedValue({
      key: "a",
      relatedKey: "b",
      action: "linked",
      keyRelatedKeys: ["b"],
      relatedKeyRelatedKeys: ["a"],
    }),
    diffMemory: vi.fn().mockResolvedValue({
      key: "k",
      from: "1",
      to: "2",
      diff: [],
      summary: { added: 0, removed: 0, unchanged: 0 },
    }),
    getMemoryVersions: vi
      .fn()
      .mockResolvedValue({ key: "k", currentVersion: 1, versions: [] }),
    restoreMemoryVersion: vi.fn().mockResolvedValue({}),
    traverseMemory: vi.fn().mockResolvedValue({
      root: "k",
      nodes: [],
      edges: [],
      maxDepthReached: false,
    }),
    getCoAccessed: vi.fn().mockResolvedValue({ key: "k", coAccessed: [] }),
    getHealthScores: vi.fn().mockResolvedValue({ memories: [] }),
    suggestCleanup: vi.fn().mockResolvedValue({ stale: [], expired: [] }),
    watchMemories: vi
      .fn()
      .mockResolvedValue({ changed: [], unchanged: [], checkedAt: 0 }),
    exportMemories: vi.fn().mockResolvedValue("# Exported"),
    logActivity: vi.fn().mockResolvedValue({}),
    getActivityLogs: vi.fn().mockResolvedValue({ activityLogs: [] }),
    runLifecycle: vi.fn().mockResolvedValue({ results: {} }),
    validateReferences: vi.fn().mockResolvedValue({
      totalMemoriesChecked: 0,
      issuesFound: 0,
      issues: [],
      recommendation: "",
    }),
    incrementalSync: vi
      .fn()
      .mockResolvedValue({ created: 0, updated: 0, deleted: 0 }),
    batch: vi.fn().mockResolvedValue({ results: [] }),
    batchMutate: vi.fn().mockResolvedValue({
      action: "archive",
      requested: 0,
      matched: 0,
      affected: 0,
    }),
    lockMemory: vi.fn().mockResolvedValue({ lock: {}, acquired: true }),
    unlockMemory: vi.fn().mockResolvedValue({ key: "k", released: true }),
    rollbackMemory: vi
      .fn()
      .mockResolvedValue({ key: "k", rolledBackTo: 1, stepsBack: 1 }),
    getAnalytics: vi.fn().mockResolvedValue({ totalMemories: 0 }),
    getChanges: vi
      .fn()
      .mockResolvedValue({ since: 0, until: 0, summary: {}, changes: [] }),
    listSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
    createSnapshot: vi.fn().mockResolvedValue({
      snapshot: { id: "s1", name: "snap", memoryCount: 0 },
    }),
    listTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    createTemplate: vi
      .fn()
      .mockResolvedValue({ template: { id: "t1", name: "tmpl" } }),
    applyTemplate: vi.fn().mockResolvedValue({ applied: true }),
    checkFreshness: vi.fn().mockResolvedValue({ memoryCount: 0, hash: "abc" }),
    getDelta: vi.fn().mockResolvedValue({
      created: [],
      updated: [],
      deleted: [],
      since: 0,
      now: 0,
    }),
    listOrgDefaults: vi.fn().mockResolvedValue({ defaults: [] }),
    setOrgDefault: vi.fn().mockResolvedValue({ default: {} }),
    deleteOrgDefault: vi.fn().mockResolvedValue({ deleted: true }),
    applyOrgDefaults: vi.fn().mockResolvedValue({ applied: true }),
    searchOrgMemories: vi.fn().mockResolvedValue({
      results: [],
      grouped: {},
      projectsSearched: 0,
      totalMatches: 0,
    }),
    orgContextDiff: vi.fn().mockResolvedValue({
      projectA: "a",
      projectB: "b",
      onlyInA: [],
      onlyInB: [],
      common: [],
      stats: {},
    }),
    runScheduledLifecycle: vi.fn().mockResolvedValue({ scheduled: true }),
    getConnectionStatus: vi.fn().mockReturnValue({ online: true }),
    getLastFreshness: vi.fn().mockReturnValue("fresh"),
    getLocalCacheSyncAt: vi.fn().mockReturnValue(0),
  } as unknown;
}

/** Creates a mock rate limit state that always allows writes. */
function createMockRateLimitState() {
  return {
    RATE_LIMIT: 500,
    writeCallCount: 0,
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
    incrementWriteCount: vi.fn(),
    getSessionWriteWarning: vi.fn().mockReturnValue(null),
  };
}

/** Extracts the text content from a tool response. */
function getResponseText(response: {
  content: Array<{ type: string; text: string }>;
}): string {
  return response.content[0]?.text ?? "";
}

/** Checks whether a response is an error. */
function isErrorResponse(response: { isError?: boolean }): boolean {
  return response.isError === true;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Tool Dispatch: memory", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimitState>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimitState();

    const { registerMemoryTool } = await import("../tools/handlers/memory");
    registerMemoryTool(server as any, client as any, rl);
  });

  it("registers the 'memory' tool", () => {
    expect(server.tools["memory"]).toBeDefined();
    expect(server.tools["memory"]!.description).toContain("Core memory CRUD");
  });

  describe("action: store", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "store", content: "hello" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key and content are required");
    });

    it("returns error when content is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "store", key: "my-key" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key and content are required");
    });

    it("stores memory with valid key and content", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "store",
        key: "my-key",
        content:
          "Auth middleware runs before project access checks in the API route.",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain(
        "Memory stored with key: my-key",
      );
      expect((client as any).storeMemory).toHaveBeenCalled();
    });

    it("skips low-signal generic capability notes", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "store",
        key: "note-key",
        content: "Use rg to search for patterns in files.",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Skipped low-signal memory");
      expect((client as any).storeMemory).not.toHaveBeenCalled();
    });

    it("checks rate limit before storing", async () => {
      const handler = server.tools["memory"]!.handler;
      await handler({ action: "store", key: "k", content: "c" });
      expect(rl.checkRateLimit).toHaveBeenCalled();
      expect(rl.incrementWriteCount).toHaveBeenCalled();
    });

    it("returns error when rate limit is exceeded", async () => {
      rl.checkRateLimit.mockReturnValue({
        allowed: false,
        warning: "Rate limit reached",
      });
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "store", key: "k", content: "c" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("Rate limit");
    });
  });

  describe("action: get", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "get" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key is required");
    });

    it("retrieves memory with valid key", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "get", key: "my-key" });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).getMemory).toHaveBeenCalledWith("my-key");
    });

    it("calls prefetchCoAccessed after get", async () => {
      const handler = server.tools["memory"]!.handler;
      await handler({ action: "get", key: "my-key" });
      expect((client as any).prefetchCoAccessed).toHaveBeenCalledWith("my-key");
    });
  });

  describe("action: search", () => {
    it("returns error when query is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "search" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("query is required");
    });

    it("calls searchMemories with valid query", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "search", query: "test query" });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).searchMemories).toHaveBeenCalledWith(
        "test query",
        20,
        expect.any(Object),
      );
    });

    it("passes limit and sort options", async () => {
      const handler = server.tools["memory"]!.handler;
      await handler({
        action: "search",
        query: "q",
        limit: 5,
        sort: "priority",
      });
      expect((client as any).searchMemories).toHaveBeenCalledWith(
        "q",
        5,
        expect.objectContaining({ sort: "priority" }),
      );
    });
  });

  describe("action: list", () => {
    it("calls listMemories with defaults", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "list" });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).listMemories).toHaveBeenCalledWith(
        100,
        0,
        expect.any(Object),
      );
    });

    it("passes custom limit and offset", async () => {
      const handler = server.tools["memory"]!.handler;
      await handler({ action: "list", limit: 10, offset: 5 });
      expect((client as any).listMemories).toHaveBeenCalledWith(
        10,
        5,
        expect.any(Object),
      );
    });
  });

  describe("action: delete", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "delete" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key is required");
    });

    it("deletes memory with valid key", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "delete", key: "rm-me" });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Memory deleted: rm-me");
      expect((client as any).deleteMemory).toHaveBeenCalledWith("rm-me");
    });
  });

  describe("action: update", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "update", content: "new" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key is required");
    });

    it("updates memory with valid key", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "update",
        key: "k",
        content: "updated",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Memory updated: k");
      expect((client as any).updateMemory).toHaveBeenCalled();
    });
  });

  describe("action: pin", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "pin", pin: true });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key is required");
    });

    it("pins memory with valid params", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "pin", key: "k", pin: true });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).pinMemory).toHaveBeenCalledWith("k", true);
    });
  });

  describe("action: archive", () => {
    it("returns error when key is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "archive", archiveFlag: true });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key is required");
    });

    it("archives memory with valid params", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "archive",
        key: "k",
        archiveFlag: true,
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("archived");
      expect((client as any).archiveMemory).toHaveBeenCalledWith("k", true);
    });
  });

  describe("action: bulk_get", () => {
    it("returns error when keys is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "bulk_get" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("keys array is required");
    });

    it("returns error when keys is empty", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "bulk_get", keys: [] });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("keys array is required");
    });

    it("bulk-retrieves with valid keys", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "bulk_get", keys: ["a", "b"] });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).bulkGetMemories).toHaveBeenCalledWith(["a", "b"]);
    });
  });

  describe("action: store_safe", () => {
    it("returns error when key and content are missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "store_safe",
        ifUnmodifiedSince: 123,
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("key and content are required");
    });

    it("returns error when ifUnmodifiedSince is missing", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({
        action: "store_safe",
        key: "k",
        content: "c",
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain(
        "ifUnmodifiedSince is required",
      );
    });

    it("stores safely with valid params and no conflict", async () => {
      (client as any).getMemory.mockResolvedValue({
        memory: { content: "old", updatedAt: "2024-01-01T00:00:00Z" },
      });
      const handler = server.tools["memory"]!.handler;
      const ifUnmodifiedSince = new Date("2025-01-01").getTime();
      const result = await handler({
        action: "store_safe",
        key: "k",
        content: "c",
        ifUnmodifiedSince,
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("no conflict");
    });
  });

  describe("action: capacity", () => {
    it("returns capacity information", async () => {
      const handler = server.tools["memory"]!.handler;
      const result = await handler({ action: "capacity" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.used).toBe(10);
      expect(parsed.limit).toBe(100);
      expect(parsed.guidance).toBeDefined();
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const handler = server.tools["memory"]!.handler;
      // Bypass zod by calling the handler directly with a bogus action
      const result = await handler({ action: "nonexistent" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("Unknown action");
    });
  });
});

describe("Tool Dispatch: session", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimitState>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimitState();

    const { registerSessionTool } = await import("../tools/handlers/session");
    registerSessionTool(server as any, client as any, rl);
  });

  it("registers the 'session' tool", () => {
    expect(server.tools["session"]).toBeDefined();
    expect(server.tools["session"]!.description).toContain(
      "Session management",
    );
  });

  describe("action: start", () => {
    it("auto-generates sessionId when missing", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "start" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(typeof parsed.sessionId).toBe("string");
      expect(parsed.generatedSessionId).toBe(true);
    });

    it("starts session with valid sessionId", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({
        action: "start",
        sessionId: "sess-1",
        autoExtractGit: false,
      });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.sessionId).toBe("sess-1");
      expect((client as any).upsertSessionLog).toHaveBeenCalled();
    });
  });

  describe("action: end", () => {
    it("uses fallback summary when summary is missing", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "end", sessionId: "sess-1" });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Session sess-1 ended");
    });

    it("uses active session when sessionId is missing", async () => {
      const handler = server.tools["session"]!.handler;
      const started = await handler({
        action: "start",
        sessionId: "sess-2",
        autoExtractGit: false,
      });
      expect(isErrorResponse(started)).toBe(false);

      const ended = await handler({ action: "end", summary: "Done" });
      expect(isErrorResponse(ended)).toBe(false);
      expect(getResponseText(ended)).toContain("Session sess-2 ended");
    });

    it("ends session with valid params", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({
        action: "end",
        sessionId: "sess-1",
        summary: "Done",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Session sess-1 ended");
    });
  });

  describe("action: history", () => {
    it("returns session history", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "history" });
      expect(isErrorResponse(result)).toBe(false);
      expect((client as any).getSessionLogs).toHaveBeenCalled();
    });

    it("passes custom limit", async () => {
      const handler = server.tools["session"]!.handler;
      await handler({ action: "history", limit: 5 });
      expect((client as any).getSessionLogs).toHaveBeenCalledWith(5);
    });
  });

  describe("action: claims_check", () => {
    it("returns error when keys is missing", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "claims_check" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("keys required");
    });
  });

  describe("action: claim", () => {
    it("returns error when keys are missing", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "claim", sessionId: "s1" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("keys required");
    });

    it("claims keys with valid params", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({
        action: "claim",
        sessionId: "s1",
        keys: ["k1", "k2"],
      });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.keys).toEqual(["k1", "k2"]);
      expect((client as any).storeMemory).toHaveBeenCalled();
    });
  });

  describe("action: rate_status", () => {
    it("returns rate limit status", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "rate_status" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.callsMade).toBe(0);
      expect(parsed.limit).toBe(500);
      expect(parsed.remaining).toBe(500);
      expect(parsed.status).toBe("ok");
    });

    it("reports warning status when approaching limit", async () => {
      rl.writeCallCount = 410;
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "rate_status" });
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.percentageUsed).toBe(82);
      expect(parsed.status).toBe("warning");
    });

    it("reports blocked status when limit reached", async () => {
      rl.writeCallCount = 500;
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "rate_status" });
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.status).toBe("blocked");
      expect(parsed.remaining).toBe(0);
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const handler = server.tools["session"]!.handler;
      const result = await handler({ action: "bogus" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("Unknown action");
    });
  });
});

describe("Tool Dispatch: branch", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimitState>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimitState();

    const { registerBranchTool } = await import("../tools/handlers/branch");
    registerBranchTool(server as any, client as any, rl);
  });

  it("registers the 'branch' tool", () => {
    expect(server.tools["branch"]).toBeDefined();
    expect(server.tools["branch"]!.description).toContain(
      "Branch context management",
    );
  });

  describe("action: get", () => {
    it("returns branch info with default branch", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "get" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.selectedBranch).toBe("main");
      expect(parsed.branchPlanKey).toBe("agent/context/branch_plan/main");
    });

    it("uses explicit branch when provided", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "get", branch: "feature/xyz" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.selectedBranch).toBe("feature/xyz");
    });

    it("returns error when no branch can be detected", async () => {
      const agentContext = await import("../agent-context");
      (
        agentContext.getBranchInfo as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "get" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("No git branch detected");
    });
  });

  describe("action: set", () => {
    it("returns error when content is missing", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "set" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("content required");
    });

    it("sets branch context with valid content", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({
        action: "set",
        content: "Plan for feature X",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Branch context saved");
      expect((client as any).storeMemory).toHaveBeenCalled();
    });

    it("includes checklist progress in response", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({
        action: "set",
        content: "Plan",
        checklist: [
          { item: "Step 1", done: true },
          { item: "Step 2", done: false },
          { item: "Step 3", done: true },
        ],
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("2/3 items done");
    });

    it("includes status in response", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({
        action: "set",
        content: "Plan",
        status: "review",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("[review]");
    });
  });

  describe("action: delete", () => {
    it("deletes branch context", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "delete" });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain("Branch context deleted");
      expect((client as any).deleteMemory).toHaveBeenCalled();
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const handler = server.tools["branch"]!.handler;
      const result = await handler({ action: "invalid" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("Unknown action");
    });
  });
});

describe("Tool Dispatch: context_config", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimitState>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimitState();

    const { registerContextConfigTool } =
      await import("../tools/handlers/context-config");
    registerContextConfigTool(server as any, client as any, rl);
  });

  it("registers the 'context_config' tool", () => {
    expect(server.tools["context_config"]).toBeDefined();
    expect(server.tools["context_config"]!.description).toContain(
      "Context type configuration",
    );
  });

  describe("action: type_create", () => {
    it("returns error when slug is missing", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "type_create",
        label: "My Type",
        description: "desc",
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain(
        "slug, label, and description required",
      );
    });

    it("returns error when label is missing", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "type_create",
        slug: "my-type",
        description: "desc",
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain(
        "slug, label, and description required",
      );
    });

    it("returns error when description is missing", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "type_create",
        slug: "my-type",
        label: "My Type",
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain(
        "slug, label, and description required",
      );
    });

    it("creates custom context type with valid params", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "type_create",
        slug: "my-type",
        label: "My Type",
        description: "A custom type",
      });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain(
        "Custom context type created: my-type",
      );
      expect(getResponseText(result)).toContain('"My Type"');
      expect((client as any).createContextType).toHaveBeenCalledWith({
        slug: "my-type",
        label: "My Type",
        description: "A custom type",
      });
    });

    it("invalidates custom types cache after creation", async () => {
      const agentContext = await import("../agent-context");
      const handler = server.tools["context_config"]!.handler;
      await handler({
        action: "type_create",
        slug: "my-type",
        label: "My Type",
        description: "desc",
      });
      expect(agentContext.invalidateCustomTypesCache).toHaveBeenCalled();
    });
  });

  describe("action: type_list", () => {
    it("returns list of context types", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({ action: "type_list" });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.types).toBeDefined();
      expect(Array.isArray(parsed.types)).toBe(true);
    });
  });

  describe("action: type_delete", () => {
    it("returns error when slug is missing", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({ action: "type_delete" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("slug required");
    });

    it("deletes custom context type with valid slug", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({ action: "type_delete", slug: "my-type" });
      expect(isErrorResponse(result)).toBe(false);
      expect(getResponseText(result)).toContain(
        "Custom context type deleted: my-type",
      );
      expect((client as any).deleteContextType).toHaveBeenCalledWith("my-type");
    });
  });

  describe("action: template_get", () => {
    it("returns error when type is missing", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({ action: "template_get" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("type required");
    });

    it("returns template for known built-in type", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "template_get",
        type: "coding_style",
      });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.type).toBe("coding_style");
      expect(parsed.template).toBeDefined();
      expect(parsed.description).toContain("Coding conventions");
    });

    it("returns template for architecture type", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "template_get",
        type: "architecture",
      });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.type).toBe("architecture");
      expect(parsed.template).toContain("Module Boundaries");
    });

    it("returns error for unknown type with no custom match", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "template_get",
        type: "nonexistent_xyz",
      });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain(
        'Unknown type "nonexistent_xyz"',
      );
    });

    it("returns generic template for known custom type", async () => {
      const agentContext = await import("../agent-context");
      (
        agentContext.getAllContextTypeInfo as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        my_custom: { label: "My Custom", description: "Custom desc" },
      });
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({
        action: "template_get",
        type: "my_custom",
      });
      expect(isErrorResponse(result)).toBe(false);
      const parsed = JSON.parse(getResponseText(result));
      expect(parsed.type).toBe("my_custom");
      expect(parsed.note).toContain("Generic template");
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const handler = server.tools["context_config"]!.handler;
      const result = await handler({ action: "bad_action" });
      expect(isErrorResponse(result)).toBe(true);
      expect(getResponseText(result)).toContain("Unknown action");
    });
  });
});
