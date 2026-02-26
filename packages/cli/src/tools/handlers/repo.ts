import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse, matchGlob } from "../response.js";
import { buildAgentContextKey } from "../../agent-context.js";

const execFileAsync = promisify(execFile);

export function registerRepoTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
  onToolCall: (tool: string, action: string) => void,
) {
  server.tool(
    "repo",
    "Repository operations. Actions: scan, scan_check, onboard",
    {
      action: z
        .enum(["scan", "scan_check", "onboard"])
        .describe("Which operation to perform"),
      maxFiles: z
        .number()
        .int()
        .min(10)
        .max(5000)
        .optional()
        .describe("[scan] Max files to include"),
      includePatterns: z
        .array(z.string())
        .optional()
        .describe("[scan] Glob patterns to include"),
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("[scan] Glob patterns to exclude"),
      saveAsContext: z
        .boolean()
        .optional()
        .describe("[scan] Save result as context entry"),
      apply: z
        .boolean()
        .optional()
        .describe("[onboard] Store generated memories"),
    },
    async (params) => {
      onToolCall("repo", params.action);
      try {
        switch (params.action) {
          case "scan": {
            const args = [
              "ls-files",
              "--cached",
              "--others",
              "--exclude-standard",
            ];
            const result = await execFileAsync("git", args, {
              cwd: process.cwd(),
              maxBuffer: 10 * 1024 * 1024,
            });
            let files = result.stdout.trim().split("\n").filter(Boolean);
            if (params.includePatterns?.length)
              files = files.filter((f) =>
                params.includePatterns!.some((p) => matchGlob(f, p)),
              );
            if (params.excludePatterns?.length)
              files = files.filter(
                (f) => !params.excludePatterns!.some((p) => matchGlob(f, p)),
              );
            files = files.slice(0, params.maxFiles ?? 1000);

            const byDir: Record<string, string[]> = {};
            const byExt: Record<string, number> = {};
            for (const file of files) {
              const parts = file.split("/");
              const topDir = parts.length > 1 ? parts[0] : ".";
              if (!byDir[topDir]) byDir[topDir] = [];
              byDir[topDir].push(file);
              const ext = file.includes(".")
                ? file.split(".").pop()!
                : "no-ext";
              byExt[ext] = (byExt[ext] ?? 0) + 1;
            }

            const fileMap = {
              totalFiles: files.length,
              directories: Object.entries(byDir)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([dir, dirFiles]) => ({
                  directory: dir,
                  fileCount: dirFiles.length,
                  files: dirFiles.slice(0, 50),
                  truncated: dirFiles.length > 50,
                })),
              extensionBreakdown: Object.entries(byExt)
                .sort((a, b) => b[1] - a[1])
                .map(([ext, count]) => ({ extension: ext, count })),
            };

            if (params.saveAsContext) {
              const content = JSON.stringify(fileMap, null, 2);
              const key = buildAgentContextKey("file_map", "auto-scan");
              await client.storeMemory(key, content, {
                scope: "agent_functionality",
                type: "file_map",
                id: "auto-scan",
                title: "Auto-scanned file map",
                updatedByTool: "repo.scan",
                updatedAt: new Date().toISOString(),
              });
              return textResponse(
                `Repository scanned: ${files.length} files. Saved as ${key}.`,
              );
            }
            return textResponse(JSON.stringify(fileMap, null, 2));
          }
          case "scan_check": {
            const result = await execFileAsync(
              "git",
              ["ls-files", "--cached", "--others", "--exclude-standard"],
              { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
            );
            const currentFiles = new Set(
              result.stdout.trim().split("\n").filter(Boolean),
            );
            const key = buildAgentContextKey("file_map", "auto-scan");
            let storedMap: {
              totalFiles?: number;
              directories?: Array<{ files?: string[] }>;
            } | null = null;
            try {
              const mem = (await client.getMemory(key)) as {
                memory?: { content?: string };
              };
              if (mem?.memory?.content)
                storedMap = JSON.parse(mem.memory.content);
            } catch {
              return textResponse(
                "No stored file_map found. Run repo scan first.",
              );
            }
            const storedFiles = new Set<string>();
            if (storedMap?.directories) {
              for (const dir of storedMap.directories) {
                if (dir.files) {
                  for (const f of dir.files) storedFiles.add(f);
                }
              }
            }
            const newFiles = [...currentFiles].filter(
              (f) => !storedFiles.has(f),
            );
            const deletedFiles = [...storedFiles].filter(
              (f) => !currentFiles.has(f),
            );
            const isStale = newFiles.length > 0 || deletedFiles.length > 0;
            return textResponse(
              JSON.stringify(
                {
                  isStale,
                  currentFileCount: currentFiles.size,
                  storedFileCount: storedFiles.size,
                  newFiles: newFiles.slice(0, 50),
                  deletedFiles: deletedFiles.slice(0, 50),
                  newFilesTotal: newFiles.length,
                  deletedFilesTotal: deletedFiles.length,
                  recommendation: isStale
                    ? "Run repo scan with saveAsContext=true to update."
                    : "File map is up to date.",
                },
                null,
                2,
              ),
            );
          }
          case "onboard":
            return handleOnboard(client, params.apply ?? false);
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in repo.${params.action}`, error);
      }
    },
  );
}

async function handleOnboard(client: ApiClient, apply: boolean) {
  const cwd = process.cwd();
  const detected: Record<string, string> = {};
  const suggestions: Array<{
    type: string;
    id: string;
    title: string;
    content: string;
    priority: number;
  }> = [];

  async function readFile(path: string): Promise<string | null> {
    try {
      const result = await execFileAsync("cat", [path], { cwd });
      return result.stdout;
    } catch {
      return null;
    }
  }

  const pnpmLock = await readFile("pnpm-lock.yaml");
  const bunLock = await readFile("bun.lockb");
  const yarnLock = await readFile("yarn.lock");
  if (pnpmLock) detected.packageManager = "pnpm";
  else if (bunLock) detected.packageManager = "bun";
  else if (yarnLock) detected.packageManager = "yarn";
  else detected.packageManager = "npm";

  const pkgJson = await readFile("package.json");
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson) as Record<string, unknown>;
      const deps = {
        ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
        ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
      };
      if (deps.next) detected.framework = "Next.js";
      else if (deps.nuxt) detected.framework = "Nuxt";
      else if (deps.svelte || deps["@sveltejs/kit"])
        detected.framework = "SvelteKit";
      else if (deps.react) detected.framework = "React";
      else if (deps.vue) detected.framework = "Vue";
      else if (deps.express) detected.framework = "Express";
      else if (deps.fastify) detected.framework = "Fastify";
      else if (deps.hono) detected.framework = "Hono";
      if (deps.vitest) detected.testRunner = "vitest";
      else if (deps.jest) detected.testRunner = "jest";
      else if (deps.mocha) detected.testRunner = "mocha";
      if (deps.typescript) detected.language = "TypeScript";
      else detected.language = "JavaScript";
      if (deps.eslint) detected.linter = "ESLint";
      if (deps.biome || deps["@biomejs/biome"]) detected.linter = "Biome";
      if (deps.prettier) detected.formatter = "Prettier";
      if (pkg.workspaces) detected.monorepo = "npm/yarn workspaces";
    } catch {
      /* ignore */
    }
  }

  const pnpmWorkspace = await readFile("pnpm-workspace.yaml");
  if (pnpmWorkspace) detected.monorepo = "pnpm workspaces";
  const tsconfig = await readFile("tsconfig.json");
  if (tsconfig) detected.language = "TypeScript";
  const dockerfile = await readFile("Dockerfile");
  if (dockerfile) detected.docker = "yes";
  const ghActions =
    (await readFile(".github/workflows/ci.yml")) ??
    (await readFile(".github/workflows/ci.yaml"));
  if (ghActions) detected.ci = "GitHub Actions";

  if (detected.language || detected.framework) {
    const parts: string[] = [];
    if (detected.language) parts.push(`- Language: ${detected.language}`);
    if (detected.framework) parts.push(`- Framework: ${detected.framework}`);
    if (detected.packageManager)
      parts.push(`- Package manager: ${detected.packageManager}`);
    if (detected.linter) parts.push(`- Linter: ${detected.linter}`);
    if (detected.formatter) parts.push(`- Formatter: ${detected.formatter}`);
    if (detected.monorepo) parts.push(`- Monorepo: ${detected.monorepo}`);
    suggestions.push({
      type: "coding_style",
      id: "project-stack",
      title: "Project Stack & Conventions",
      content: `## Tech Stack\n${parts.join("\n")}`,
      priority: 80,
    });
  }
  if (detected.testRunner)
    suggestions.push({
      type: "testing",
      id: "test-setup",
      title: "Test Setup",
      content: `## Test Runner\n- Runner: ${detected.testRunner}\n- Run: \`${detected.packageManager} ${detected.packageManager === "npm" ? "run " : ""}test\``,
      priority: 70,
    });
  if (detected.framework)
    suggestions.push({
      type: "architecture",
      id: "framework-overview",
      title: "Architecture Overview",
      content: `## Framework\n- ${detected.framework}${detected.monorepo ? `\n- Monorepo: ${detected.monorepo}` : ""}${detected.docker ? "\n- Containerized with Docker" : ""}`,
      priority: 75,
    });
  if (detected.ci)
    suggestions.push({
      type: "workflow",
      id: "ci-cd",
      title: "CI/CD",
      content: `## CI/CD\n- Platform: ${detected.ci}`,
      priority: 60,
    });

  try {
    const result = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd, maxBuffer: 5 * 1024 * 1024 },
    );
    const files = result.stdout.trim().split("\n").filter(Boolean);
    const topDirs = [
      ...new Set(files.map((f) => f.split("/")[0]).filter(Boolean)),
    ].sort();
    if (topDirs.length > 0)
      suggestions.push({
        type: "folder_structure",
        id: "repo-layout",
        title: "Repository Layout",
        content: `## Top-level Directories\n${topDirs.map((d) => `- ${d}/`).join("\n")}\n\n_${files.length} files total_`,
        priority: 65,
      });
  } catch {
    /* ignore */
  }

  if (apply && suggestions.length > 0) {
    const results: Array<{ key: string; status: string }> = [];
    for (const s of suggestions) {
      const key = buildAgentContextKey(s.type, s.id);
      try {
        await client.storeMemory(
          key,
          s.content,
          {
            scope: "agent_functionality",
            type: s.type,
            id: s.id,
            title: s.title,
            updatedByTool: "repo.onboard",
            updatedAt: new Date().toISOString(),
          },
          { priority: s.priority },
        );
        results.push({ key, status: "stored" });
      } catch (err) {
        results.push({
          key,
          status: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
    return textResponse(
      JSON.stringify(
        {
          detected,
          applied: true,
          stored: results.filter((r) => r.status === "stored").length,
          errors: results.filter((r) => r.status.startsWith("error")).length,
          details: results,
        },
        null,
        2,
      ),
    );
  }

  return textResponse(
    JSON.stringify(
      {
        detected,
        suggestions: suggestions.map((s) => ({
          type: s.type,
          id: s.id,
          title: s.title,
          key: buildAgentContextKey(s.type, s.id),
          priority: s.priority,
          contentPreview: s.content.slice(0, 200),
        })),
        hint:
          suggestions.length > 0
            ? `Found ${suggestions.length} suggestions. Call again with apply=true to store.`
            : "No configs detected.",
      },
      null,
      2,
    ),
  );
}
