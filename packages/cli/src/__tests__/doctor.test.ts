import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockLoadConfig = vi.fn();
const mockLoadConfigForCwd = vi.fn();
const mockGetConfigPath = vi
  .fn()
  .mockReturnValue("/tmp/test-home/.memctl/config.json");
const mockGetConfigDir = vi.fn().mockReturnValue("/tmp/test-home/.memctl");

vi.mock("../config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  loadConfigForCwd: (...args: unknown[]) => mockLoadConfigForCwd(...args),
  getConfigPath: (...args: unknown[]) => mockGetConfigPath(...args),
  getConfigDir: (...args: unknown[]) => mockGetConfigDir(...args),
}));

const mockPing = vi.fn();
const mockGetMemoryCapacity = vi.fn();

vi.mock("../api-client", () => ({
  ApiClient: class {
    ping = mockPing;
    getMemoryCapacity = mockGetMemoryCapacity;
  },
}));

const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  constants: { R_OK: 4 },
}));

// Better-sqlite3 is pulled in transitively by local-cache — stub it out
vi.mock("better-sqlite3", () => ({ default: null }));

// Capture console.log output
let logOutput: string[];
const consoleSpy = vi
  .spyOn(console, "log")
  .mockImplementation((...args: unknown[]) => {
    logOutput.push(args.map(String).join(" "));
  });

// ── Helpers ──────────────────────────────────────────────────────────────

function joinedOutput(): string {
  return logOutput.join("\n");
}

/** Standard resolved config returned by loadConfigForCwd */
const resolvedConfig = {
  baseUrl: "https://memctl.com/api/v1",
  token: "tok_test",
  org: "myorg",
  project: "myproj",
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("doctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logOutput = [];
    consoleSpy.mockClear();
  });

  async function importRunDoctor() {
    const mod = await import("../doctor");
    return mod.runDoctor;
  }

  // ── 1. Missing config file → shows warning ──────────────────────────

  describe("missing config file", () => {
    it("shows a warning when config file is absent", async () => {
      mockLoadConfig.mockResolvedValue(null);
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 10,
        limit: 100,
        isFull: false,
        isApproaching: false,
        usageRatio: 0.1,
      });
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      // The warning line contains "Not found" for the config file
      expect(output).toContain("Not found");
      expect(output).toContain("Config file");
    });
  });

  // ── 2. Missing credentials → shows failure and stops ────────────────

  describe("missing credentials", () => {
    it("shows failure and returns early when credentials cannot be resolved", async () => {
      mockLoadConfig.mockResolvedValue(null);
      mockLoadConfigForCwd.mockResolvedValue(null);
      // No fetch should happen because we stop early
      vi.stubGlobal("fetch", vi.fn());

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      // Should show the credentials failure
      expect(output).toContain("Credentials");
      expect(output).toContain("Neither env vars nor config file");
      // Should show a summary with at least 1 failure
      expect(output).toContain("failed");
      // Should NOT have attempted API connectivity
      expect(output).not.toContain("API connectivity");
    });
  });

  // ── 3. API unreachable → shows failure ─────────────────────────────

  describe("API unreachable", () => {
    it("shows failure when the health endpoint throws a network error", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      // fetch throws to simulate a network error
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      );
      // Local cache and pending writes: no file
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("API connectivity");
      expect(output).toContain("ECONNREFUSED");
      expect(output).toContain("failed");
    });

    it("shows failure when the health endpoint returns non-ok status", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      );
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("API connectivity");
      expect(output).toContain("HTTP 503");
      expect(output).toContain("failed");
    });
  });

  // ── 4. All checks pass → shows all green ──────────────────────────

  describe("all checks pass", () => {
    it("shows all passing checks with correct summary", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 5,
        limit: 1000,
        isFull: false,
        isApproaching: false,
        usageRatio: 0.005,
      });
      // Local cache exists
      mockAccess.mockResolvedValue(undefined);
      // No pending writes file
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      // All critical checks should appear
      expect(output).toContain("Config file");
      expect(output).toContain("Credentials resolved");
      expect(output).toContain("API connectivity");
      expect(output).toContain("Auth token valid");
      expect(output).toContain("Org/project access");
      expect(output).toContain("Memory capacity");
      expect(output).toContain("Local cache");
      expect(output).toContain("Pending writes");
      // Summary should show passed and no failures
      expect(output).toContain("passed");
      expect(output).not.toContain("failed");
    });
  });

  // ── 5. Partial failure states ─────────────────────────────────────

  describe("partial failure states", () => {
    it("reports auth token failure even when API is online", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      // API is reachable but ping (auth check) fails
      mockPing.mockResolvedValue(false);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 0,
        limit: 100,
        isFull: false,
        isApproaching: false,
        usageRatio: 0,
      });
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      // API connectivity should pass
      expect(output).toContain("API connectivity");
      // Auth token should fail
      expect(output).toContain("Auth token");
      expect(output).toContain("Ping returned false");
      expect(output).toContain("failed");
    });

    it("reports memory capacity full as failure", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 1000,
        limit: 1000,
        isFull: true,
        isApproaching: false,
        usageRatio: 1.0,
      });
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("Memory capacity");
      expect(output).toContain("FULL");
      expect(output).toContain("failed");
    });

    it("reports memory capacity approaching as warning", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 85,
        limit: 100,
        isFull: false,
        isApproaching: true,
        usageRatio: 0.85,
      });
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("Memory capacity");
      expect(output).toContain("85%");
      expect(output).toContain("warning");
    });

    it("reports pending writes when queue is non-empty", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 10,
        limit: 100,
        isFull: false,
        isApproaching: false,
        usageRatio: 0.1,
      });
      mockAccess.mockResolvedValue(undefined);
      // pending-writes.json has 3 items
      mockReadFile.mockResolvedValue(
        JSON.stringify([{ key: "a" }, { key: "b" }, { key: "c" }]),
      );

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("Pending writes");
      expect(output).toContain("3 write(s) queued");
      expect(output).toContain("warning");
    });

    it("reports missing local cache as warning", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockResolvedValue({
        used: 10,
        limit: 100,
        isFull: false,
        isApproaching: false,
        usageRatio: 0.1,
      });
      // Local cache does NOT exist
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("Local cache");
      expect(output).toContain("No cache.db found");
      expect(output).toContain("warning");
    });

    it("handles org/project access error gracefully", async () => {
      mockLoadConfig.mockResolvedValue({ profiles: {}, projects: {} });
      mockLoadConfigForCwd.mockResolvedValue(resolvedConfig);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockPing.mockResolvedValue(true);
      mockGetMemoryCapacity.mockRejectedValue(new Error("403 Forbidden"));
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const runDoctor = await importRunDoctor();
      await runDoctor();

      const output = joinedOutput();
      expect(output).toContain("Org/project access");
      expect(output).toContain("403 Forbidden");
      expect(output).toContain("failed");
    });
  });
});
