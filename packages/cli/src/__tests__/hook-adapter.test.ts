import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runHookAdapterCommand } from "../hook-adapter";

describe("hook adapter command", () => {
  it("prints adapter templates without writing", async () => {
    const result = await runHookAdapterCommand({
      positional: ["claude"],
      flags: {},
    });
    const files = result.files as Array<{ path: string; content: string }>;
    expect(Array.isArray(files)).toBe(true);
    expect(files.some((f) => f.path.includes("memctl-hook-dispatch.sh"))).toBe(
      true,
    );
    expect(
      files.some((f) => f.path.includes("claude.settings.local.json.example")),
    ).toBe(true);
    expect(
      files.some((f) => f.path.includes("claude.settings.local.json.example")),
    ).toBe(true);
  });

  it("writes adapter files when --write is used", async () => {
    const dir = await mkdtemp(join(tmpdir(), "memctl-hook-adapter-"));
    const result = await runHookAdapterCommand({
      positional: [],
      flags: { agent: "cursor", dir, write: true },
    });
    const written = result.written as string[];
    expect(written.length).toBe(3);

    const dispatcherPath = written.find((p) =>
      p.endsWith("memctl-hook-dispatch.sh"),
    );
    const cursorPath = written.find((p) => p.endsWith("cursor.mcp.json.example"));
    const cursorHooksPath = written.find((p) =>
      p.endsWith("cursor.hooks.md.example"),
    );
    expect(dispatcherPath).toBeTruthy();
    expect(cursorPath).toBeTruthy();
    expect(cursorHooksPath).toBeTruthy();

    const cursorConfig = await readFile(cursorPath!, "utf-8");
    expect(cursorConfig).toContain('"mcpServers"');
    expect(cursorConfig).toContain('"memctl"');
  });

  it("writes multi-agent scaffold for --agent all", async () => {
    const dir = await mkdtemp(join(tmpdir(), "memctl-hook-adapter-all-"));
    const result = await runHookAdapterCommand({
      positional: [],
      flags: { agent: "all", dir, write: true },
    });
    const written = result.written as string[];

    expect(
      written.some((p) => p.endsWith("claude.settings.local.json.example")),
    ).toBe(true);
    expect(written.some((p) => p.endsWith("vscode.mcp.json.example"))).toBe(true);
    expect(written.some((p) => p.endsWith("continue.config.yaml.example"))).toBe(
      true,
    );
    expect(written.some((p) => p.endsWith("zed.settings.json.example"))).toBe(
      true,
    );
  });
});
