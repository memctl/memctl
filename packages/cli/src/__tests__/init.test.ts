import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

vi.mock("node:os", () => ({
  homedir: () => "/tmp/test-home",
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: () =>
    vi.fn().mockRejectedValue(new Error("no git remote")),
}));

const mockLoadConfig = vi.fn();
const mockSaveConfig = vi.fn();

vi.mock("../config", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
}));

// Suppress console output during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});

// ── Tests ────────────────────────────────────────────────────────────────

describe("init – writeIdeConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    // By default, readFile rejects (no existing file)
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockSaveConfig.mockResolvedValue(undefined);
  });

  // Helper to import runInit freshly (modules are cached per vi.mock scope)
  async function importRunInit() {
    const mod = await import("../init");
    return mod.runInit;
  }

  // ── 1. Config file creation via writeIdeConfigs ────────────────────────

  describe("config file creation", () => {
    it("writes valid JSON with mcpServers.memctl when --claude flag is used", async () => {
      mockLoadConfig.mockResolvedValue({
        profiles: {
          default: {
            token: "tok_abc",
            apiUrl: "https://memctl.com/api/v1",
          },
        },
        projects: {
          [process.cwd()]: { org: "myorg", project: "myproj", profile: "default" },
        },
      });

      const runInit = await importRunInit();
      await runInit({ claude: true });

      // mkdir should have been called for .claude dir
      expect(mockMkdir).toHaveBeenCalled();

      // writeFile should have been called with a JSON string
      expect(mockWriteFile).toHaveBeenCalled();
      const [writePath, writeContent] = mockWriteFile.mock.calls[0];
      expect(writePath).toContain(".claude");
      expect(writePath).toContain("mcp.json");

      const parsed = JSON.parse(writeContent);
      expect(parsed).toHaveProperty("mcpServers");
      expect(parsed.mcpServers).toHaveProperty("memctl");
      expect(parsed.mcpServers.memctl).toHaveProperty("command", "npx");
      expect(parsed.mcpServers.memctl).toHaveProperty("args");
      expect(parsed.mcpServers.memctl.env).toMatchObject({
        MEMCTL_TOKEN: "tok_abc",
        MEMCTL_API_URL: "https://memctl.com/api/v1",
        MEMCTL_ORG: "myorg",
        MEMCTL_PROJECT: "myproj",
      });
    });

    it("writes JSON ending with a newline", async () => {
      mockLoadConfig.mockResolvedValue({
        profiles: {
          default: { token: "t", apiUrl: "https://example.com" },
        },
        projects: {
          [process.cwd()]: { org: "o", project: "p", profile: "default" },
        },
      });

      const runInit = await importRunInit();
      await runInit({ claude: true });

      const [, content] = mockWriteFile.mock.calls[0];
      expect(content).toMatch(/\n$/);
    });
  });

  // ── 2. IDE config writing — .claude/mcp.json structure ─────────────────

  describe("IDE config writing", () => {
    const fakeConfig = {
      profiles: {
        default: { token: "tok_test", apiUrl: "https://api.example.com/v1" },
      },
      projects: {
        [process.cwd()]: { org: "acme", project: "widget", profile: "default" },
      },
    };

    it("creates .claude/mcp.json with correct mcpServers.memctl structure", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ claude: true });

      const [path, raw] = mockWriteFile.mock.calls[0];
      expect(path).toMatch(/\.claude[/\\]mcp\.json$/);

      const parsed = JSON.parse(raw);
      expect(parsed.mcpServers.memctl).toEqual({
        command: "npx",
        args: ["-y", "memctl@latest"],
        env: {
          MEMCTL_TOKEN: "tok_test",
          MEMCTL_API_URL: "https://api.example.com/v1",
          MEMCTL_ORG: "acme",
          MEMCTL_PROJECT: "widget",
        },
      });
    });

    it("creates .cursor/mcp.json when --cursor flag is used", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ cursor: true });

      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toMatch(/\.cursor[/\\]mcp\.json$/);
    });

    it("creates windsurf config in homedir when --windsurf flag is used", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ windsurf: true });

      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toContain("/tmp/test-home");
      expect(path).toContain("mcp_config.json");
    });
  });

  // ── 3. Merging with existing IDE config ───────────────────────────────

  describe("merging with existing IDE config", () => {
    const fakeConfig = {
      profiles: {
        default: { token: "t", apiUrl: "https://api.test" },
      },
      projects: {
        [process.cwd()]: { org: "o", project: "p", profile: "default" },
      },
    };

    it("preserves existing mcpServers entries when merging", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      // Simulate an existing mcp.json with another server
      const existingConfig = {
        mcpServers: {
          "other-tool": {
            command: "other-tool",
            args: ["serve"],
          },
        },
        customSetting: true,
      };
      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      const runInit = await importRunInit();
      await runInit({ claude: true });

      const [, raw] = mockWriteFile.mock.calls[0];
      const parsed = JSON.parse(raw);

      // The existing "other-tool" server should still be present
      expect(parsed.mcpServers["other-tool"]).toEqual({
        command: "other-tool",
        args: ["serve"],
      });

      // The new memctl entry should also be present
      expect(parsed.mcpServers.memctl).toBeDefined();
      expect(parsed.mcpServers.memctl.command).toBe("npx");

      // Top-level custom settings should be preserved
      expect(parsed.customSetting).toBe(true);
    });

    it("overwrites existing memctl entry with new values", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const existingConfig = {
        mcpServers: {
          memctl: {
            command: "old-command",
            args: ["old"],
            env: { MEMCTL_TOKEN: "old-token" },
          },
        },
      };
      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));

      const runInit = await importRunInit();
      await runInit({ claude: true });

      const [, raw] = mockWriteFile.mock.calls[0];
      const parsed = JSON.parse(raw);

      // memctl entry should have the new values, not the old ones
      expect(parsed.mcpServers.memctl.command).toBe("npx");
      expect(parsed.mcpServers.memctl.env.MEMCTL_TOKEN).toBe("t");
    });
  });

  // ── 4. Flag handling ──────────────────────────────────────────────────

  describe("flag handling", () => {
    const fakeConfig = {
      profiles: {
        default: { token: "t", apiUrl: "https://api.test" },
      },
      projects: {
        [process.cwd()]: { org: "o", project: "p", profile: "default" },
      },
    };

    it("--claude writes only .claude config", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ claude: true });

      // Should only write one config file
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toContain(".claude");
    });

    it("--all writes configs for claude, cursor, and windsurf", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ all: true });

      // Should write three config files
      expect(mockWriteFile).toHaveBeenCalledTimes(3);

      const paths = mockWriteFile.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(paths.some((p: string) => p.includes(".claude"))).toBe(true);
      expect(paths.some((p: string) => p.includes(".cursor"))).toBe(true);
      expect(paths.some((p: string) => p.includes("mcp_config.json"))).toBe(true);
    });

    it("--cursor writes only .cursor config", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ cursor: true });

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toContain(".cursor");
    });

    it("--windsurf writes only windsurf config", async () => {
      mockLoadConfig.mockResolvedValue(fakeConfig);

      const runInit = await importRunInit();
      await runInit({ windsurf: true });

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toContain("mcp_config.json");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("exits with error when no config is found and no override provided", async () => {
      mockLoadConfig.mockResolvedValue(null);

      const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);

      const runInit = await importRunInit();
      await expect(runInit({ claude: true })).rejects.toThrow("process.exit called");

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it("exits when config exists but cwd project is not found", async () => {
      mockLoadConfig.mockResolvedValue({
        profiles: { default: { token: "t", apiUrl: "https://x" } },
        projects: {
          "/some/other/path": { org: "o", project: "p", profile: "default" },
        },
      });

      const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);

      const runInit = await importRunInit();
      await expect(runInit({ claude: true })).rejects.toThrow("process.exit called");

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it("creates parent directories recursively via mkdir", async () => {
      mockLoadConfig.mockResolvedValue({
        profiles: { default: { token: "t", apiUrl: "https://x" } },
        projects: {
          [process.cwd()]: { org: "o", project: "p", profile: "default" },
        },
      });

      const runInit = await importRunInit();
      await runInit({ claude: true });

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });
  });
});
