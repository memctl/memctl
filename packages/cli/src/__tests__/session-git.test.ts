/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSessionTracker,
  startSessionLifecycle,
} from "../session-tracker";
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

describe("session tool – start (simplified)", () => {
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

  it("starts a session and returns handoff from tracker", async () => {
    tracker.handoff = {
      previousSessionId: "prev-sess",
      summary: "Did stuff",
      branch: "main",
      keysWritten: ["key1"],
      endedAt: "2026-02-21T11:00:00Z",
    };

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-1",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sessionId).toBe("test-session-1");
    expect(parsed.handoff).toBeDefined();
    expect(parsed.handoff.previousSessionId).toBe("prev-sess");
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

  it("does not fetch session logs or close stale sessions", async () => {
    const handler = server.tools["session"].handler;
    await handler({
      action: "start",
      sessionId: "test-session-3",
    });

    // start no longer calls getSessionLogs directly
    expect(client.getSessionLogs).not.toHaveBeenCalled();
  });
});

describe("startSessionLifecycle – auto-close stale sessions", () => {
  let client: ReturnType<typeof createMockClient>;
  let tracker: SessionTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2026-02-21T12:00:00Z") });
    client = createMockClient();
    tracker = createSessionTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

    const { cleanup } = startSessionLifecycle(client as any, tracker);

    // Wait for the async lifecycle to complete
    await vi.advanceTimersByTimeAsync(100);

    const closeCalls = client.upsertSessionLog.mock.calls.filter(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.sessionId === "stale-session" && arg.endedAt;
      },
    );
    expect(closeCalls).toHaveLength(1);

    cleanup();
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

    const { cleanup } = startSessionLifecycle(client as any, tracker);

    await vi.advanceTimersByTimeAsync(100);

    const closeCalls = client.upsertSessionLog.mock.calls.filter(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.sessionId === "recent-session" && arg.endedAt;
      },
    );
    expect(closeCalls).toHaveLength(0);

    cleanup();
  });

  it("builds handoff from most recent session", async () => {
    client.getSessionLogs.mockResolvedValue({
      sessionLogs: [
        {
          id: "prev-id",
          sessionId: "prev-session",
          branch: "feature/x",
          summary: "Worked on X",
          keysRead: null,
          keysWritten: '["key1","key2"]',
          toolsUsed: null,
          startedAt: Date.now() - 60_000,
          endedAt: "2026-02-21T11:59:00Z",
        },
      ],
    });

    const { cleanup } = startSessionLifecycle(client as any, tracker);

    await vi.advanceTimersByTimeAsync(100);

    expect(tracker.handoff).not.toBeNull();
    expect(tracker.handoff!.previousSessionId).toBe("prev-session");
    expect(tracker.handoff!.summary).toBe("Worked on X");
    expect(tracker.handoff!.keysWritten).toEqual(["key1", "key2"]);

    cleanup();
  });

  it("sets tracker branch from git info", async () => {
    client.getSessionLogs.mockResolvedValue({ sessionLogs: [] });

    const { cleanup } = startSessionLifecycle(client as any, tracker);

    await vi.advanceTimersByTimeAsync(100);

    expect(tracker.branch).toBe("feature/test");

    cleanup();
  });
});
