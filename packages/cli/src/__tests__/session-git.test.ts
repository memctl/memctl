/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSessionTracker } from "../session-tracker";
import type { SessionTracker } from "../session-tracker";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../agent-context", () => ({
  getBranchInfo: vi.fn().mockResolvedValue({
    branch: "feature/test",
    commit: "abc1234",
    dirty: false,
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────

function createMockServer() {
  const tools: Record<string, { handler: Function }> = {};
  return {
    tool: (
      _name: string,
      _desc: string,
      _schema: unknown,
      handler: Function,
    ) => {
      tools[_name] = { handler };
    },
    tools,
  };
}

function createMockClient() {
  return {
    storeMemory: vi.fn().mockResolvedValue({}),
    getSessionLogs: vi.fn().mockResolvedValue({ sessionLogs: [] }),
    upsertSessionLog: vi.fn().mockResolvedValue({}),
    searchMemories: vi.fn().mockResolvedValue({ memories: [] }),
    listMemories: vi.fn().mockResolvedValue({ memories: [] }),
  };
}

function createMockRateLimit() {
  return {
    RATE_LIMIT: 500,
    writeCallCount: 0,
    checkRateLimit: () => ({ allowed: true }),
    incrementWriteCount: vi.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe("session tool – start and auto-close", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimit>;
  let tracker: SessionTracker;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2026-02-21T12:00:00Z") });

    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimit();
    tracker = createSessionTracker();

    const { registerSessionTool } = await import("../tools/handlers/session");
    registerSessionTool(server as any, client as any, rl as any, tracker, vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a session without git context", async () => {
    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-1",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sessionId).toBe("test-session-1");
    expect(parsed.gitContext).toBeUndefined();
    expect(parsed.currentBranch).toBeDefined();
  });

  it("does not store any auto: prefixed memories", async () => {
    const handler = server.tools["session"].handler;
    await handler({
      action: "start",
      sessionId: "test-session-2",
    });

    const autoCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(autoCalls).toHaveLength(0);
  });

  it("ignores autoExtractGit parameter", async () => {
    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-3",
      autoExtractGit: true,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sessionId).toBe("test-session-3");
    expect(parsed.gitContext).toBeUndefined();
  });

  // ── Stale session auto-close tests ──

  it("auto-closes stale sessions older than 2 hours", async () => {
    const now = new Date("2026-02-21T12:00:00Z").getTime();
    const threeHoursAgo = now - 3 * 60 * 60 * 1000;

    client.getSessionLogs.mockResolvedValue({
      sessionLogs: [
        {
          id: "stale-id",
          sessionId: "stale-session",
          branch: "main",
          summary: null,
          keysRead: null,
          keysWritten: null,
          toolsUsed: null,
          startedAt: threeHoursAgo,
          endedAt: null,
        },
      ],
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "new-session",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.staleSessionsClosed).toBe(1);

    const closeCalls = client.upsertSessionLog.mock.calls.filter(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.sessionId === "stale-session" && arg.endedAt;
      },
    );
    expect(closeCalls).toHaveLength(1);
  });

  it("does not close recent open sessions", async () => {
    const now = new Date("2026-02-21T12:00:00Z").getTime();
    const thirtyMinAgo = now - 30 * 60 * 1000;

    client.getSessionLogs.mockResolvedValue({
      sessionLogs: [
        {
          id: "recent-id",
          sessionId: "recent-session",
          branch: "main",
          summary: null,
          keysRead: null,
          keysWritten: null,
          toolsUsed: null,
          startedAt: thirtyMinAgo,
          endedAt: null,
        },
      ],
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "new-session-2",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.staleSessionsClosed).toBe(0);

    const closeCalls = client.upsertSessionLog.mock.calls.filter(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.sessionId === "recent-session" && arg.endedAt;
      },
    );
    expect(closeCalls).toHaveLength(0);
  });
});
