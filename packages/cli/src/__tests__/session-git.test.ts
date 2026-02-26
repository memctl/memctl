/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

// Provide a promisify that returns { stdout, stderr } from the callback,
// matching the behaviour of the real promisify(execFile).
vi.mock("node:util", () => ({
  promisify:
    (fn: Function) =>
    (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, stdout: string, stderr: string) => {
          if (err) return reject(err);
          resolve({ stdout, stderr });
        });
      }),
}));

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

/**
 * Helper that makes execFileMock behave like promisified execFile.
 * Accepts a map of command prefix -> { stdout, stderr } or Error.
 * Falls back to returning empty stdout for unmatched commands.
 */
function setupExecFile(
  responses: Record<string, { stdout: string; stderr?: string } | Error>,
) {
  execFileMock.mockImplementation(
    (cmd: string, args: string[], _opts: unknown, cb: Function) => {
      // Build a lookup key from the command + first arg(s)
      const key = [cmd, ...(args ?? [])].join(" ");

      for (const [prefix, response] of Object.entries(responses)) {
        if (key.includes(prefix)) {
          if (response instanceof Error) {
            cb(response, null, null);
          } else {
            cb(null, response.stdout, response.stderr ?? "");
          }
          return;
        }
      }
      // Default: empty output (no matches)
      cb(null, "", "");
    },
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe("session tool – git auto-extraction", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: ReturnType<typeof createMockClient>;
  let rl: ReturnType<typeof createMockRateLimit>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2026-02-21T12:00:00Z") });

    server = createMockServer();
    client = createMockClient();
    rl = createMockRateLimit();

    // Set default execFile behaviour (empty output for all commands)
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, "", "");
      },
    );

    const { registerSessionTool } = await import("../tools/handlers/session");
    registerSessionTool(server as any, client as any, rl as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Git commits are returned in response but not stored ──

  it("extracts git commits and returns them without storing as memory", async () => {
    setupExecFile({
      "git log --oneline": {
        stdout: "abc1234 feat: add feature\ndef5678 fix: bug fix\n",
      },
      "git diff --stat": {
        stdout: " src/index.ts | 10 +++++++---\n 2 files changed\n",
      },
      "git diff --name-only": { stdout: "" },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-1",
    });

    // Git data should NOT be stored as memory (available via git commands)
    const autoCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(autoCalls).toHaveLength(0);

    // But should still be in the response for the agent to see
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.gitContext.commits).toContain("abc1234 feat: add feature");
    expect(parsed.gitContext.diffStat).toContain("src/index.ts");
  });

  // ── 2. TODOs are returned in response but not stored ──

  it("extracts TODOs from changed files and returns them without storing", async () => {
    setupExecFile({
      "git log --oneline": { stdout: "abc1234 feat: add feature\n" },
      "git diff --stat": { stdout: "" },
      "git diff --name-only": { stdout: "src/app.ts\nsrc/utils.ts\n" },
      "grep -n -E TODO|FIXME|HACK|XXX src/app.ts": {
        stdout:
          "12:  // TODO: refactor this function\n45:  // FIXME: handle edge case\n",
      },
      "grep -n -E TODO|FIXME|HACK|XXX src/utils.ts": {
        stdout: "3:  // HACK: temporary workaround\n",
      },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({ action: "start", sessionId: "test-session-2" });

    // No auto-memories should be stored
    const autoCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(autoCalls).toHaveLength(0);

    // TODOs should be in the response
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.gitContext.todos).toEqual(
      expect.arrayContaining([
        expect.stringContaining("src/app.ts:12:"),
        expect.stringContaining("src/utils.ts:3:"),
      ]),
    );
  });

  // ── 3. autoExtractGit=false skips git extraction ──

  it("skips git extraction when autoExtractGit is false", async () => {
    setupExecFile({
      "git log --oneline": { stdout: "abc1234 should not be extracted\n" },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-3",
      autoExtractGit: false,
    });

    // storeMemory should NOT have been called for auto:git-changes
    const gitCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(gitCalls).toHaveLength(0);

    // Response should NOT contain gitContext
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.gitContext).toBeUndefined();
  });

  // ── 4. Git errors are handled gracefully ──

  it("handles git errors gracefully without failing session start", async () => {
    setupExecFile({
      "git log": new Error("fatal: not a git repository"),
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-4",
    });

    // Session start should still succeed
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sessionId).toBe("test-session-4");
    // gitContext should be absent since extraction returned null
    expect(parsed.gitContext).toBeUndefined();

    // No auto-memories should have been stored
    const autoCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(autoCalls).toHaveLength(0);
  });

  // ── 5. Session start response includes gitContext when commits exist ──

  it("includes gitContext in the session start response when commits exist", async () => {
    setupExecFile({
      "git log --oneline": {
        stdout: "aaa1111 first commit\nbbb2222 second commit\n",
      },
      "git diff --stat": { stdout: " README.md | 5 +++++\n 1 file changed\n" },
      "git diff --name-only": { stdout: "README.md\n" },
      "grep -n -E TODO|FIXME|HACK|XXX README.md": {
        stdout: "10:  <!-- TODO: add usage section -->\n",
      },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-5",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.gitContext).toBeDefined();
    expect(parsed.gitContext.commits).toContain("aaa1111 first commit");
    expect(parsed.gitContext.commits).toContain("bbb2222 second commit");
    expect(parsed.gitContext.diffStat).toContain("README.md");
    expect(parsed.gitContext.todos).toEqual(
      expect.arrayContaining([expect.stringContaining("README.md:10:")]),
    );
  });

  // ── 6. Empty git output doesn't store memories ──

  it("does not store memories when git output is empty", async () => {
    setupExecFile({
      "git log --oneline": { stdout: "" },
      "git diff --stat": { stdout: "" },
      "git diff --name-only": { stdout: "" },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-6",
    });

    // No auto-memories should be stored
    const autoCalls = client.storeMemory.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).startsWith("auto:"),
    );
    expect(autoCalls).toHaveLength(0);

    // gitContext should not be in the response
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.gitContext).toBeUndefined();
  });

  // ── Additional edge-case tests ──

  it("passes --since flag when a previous session exists", async () => {
    const endedAt = new Date("2026-02-20T10:00:00Z").getTime();
    client.getSessionLogs.mockResolvedValue({
      sessionLogs: [
        {
          id: "prev-id",
          sessionId: "prev-session",
          branch: "main",
          summary: "previous work",
          keysRead: null,
          keysWritten: null,
          toolsUsed: null,
          startedAt: null,
          endedAt,
        },
      ],
    });

    const sinceArgs: string[][] = [];
    execFileMock.mockImplementation(
      (cmd: string, args: string[], _opts: unknown, cb: Function) => {
        if (cmd === "git" && args[0] === "log") {
          sinceArgs.push(args);
          cb(null, "ccc3333 recent commit\n", "");
        } else {
          cb(null, "", "");
        }
      },
    );

    const handler = server.tools["session"].handler;
    await handler({ action: "start", sessionId: "test-session-7" });

    // Verify git log was called with --since
    expect(sinceArgs.length).toBeGreaterThan(0);
    const logArgs = sinceArgs[0];
    expect(logArgs).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^--since=2026-02-20T10:00:00/),
      ]),
    );
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

    // Verify upsertSessionLog was called to close stale session
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

    // Verify upsertSessionLog was NOT called with endedAt for the recent session
    const closeCalls = client.upsertSessionLog.mock.calls.filter(
      (call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.sessionId === "recent-session" && arg.endedAt;
      },
    );
    expect(closeCalls).toHaveLength(0);
  });

  it("returns gitContext even when storeMemory would fail", async () => {
    setupExecFile({
      "git log --oneline": { stdout: "ddd4444 some commit\n" },
      "git diff --stat": { stdout: "" },
      "git diff --name-only": { stdout: "" },
    });

    const handler = server.tools["session"].handler;
    const result = await handler({
      action: "start",
      sessionId: "test-session-8",
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sessionId).toBe("test-session-8");
    expect(parsed.gitContext).toBeDefined();
    expect(parsed.gitContext.commits).toContain("ddd4444 some commit");
  });
});
