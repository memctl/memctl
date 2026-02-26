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

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────

function createMockClient() {
  return {
    storeMemory: vi.fn().mockResolvedValue({}),
    getSessionLogs: vi.fn().mockResolvedValue({ sessionLogs: [] }),
    upsertSessionLog: vi.fn().mockResolvedValue({}),
    searchMemories: vi.fn().mockResolvedValue({ memories: [] }),
    listMemories: vi.fn().mockResolvedValue({ memories: [] }),
  };
}

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
