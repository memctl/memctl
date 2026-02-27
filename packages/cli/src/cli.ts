import { createRequire } from "node:module";
import { ApiClient, ApiError } from "./api-client.js";
import { getConfigPath, loadConfigForCwd } from "./config.js";
import { bold, cyan, green, red, yellow, isInteractiveTty } from "./ui.js";
import { DEFAULT_AGENTS_MD_TEMPLATE, wrapForTool } from "./agents-template.js";

const AGENTS_MD_EMPTY_SCAFFOLD =
  "# AGENTS.md\n\n> Auto-generated from memctl structured agent context";

function resolveExportResultContent(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object") {
    const data = result as Record<string, unknown>;
    if (typeof data.content === "string") {
      return data.content;
    }
  }

  return JSON.stringify(result, null, 2);
}

function shouldUseAgentsTemplateFallback(content: string): boolean {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return true;
  }

  if (!normalized.includes("## ")) {
    return true;
  }

  return normalized === AGENTS_MD_EMPTY_SCAFFOLD;
}

function normalizeExportContent(
  content: string,
  format: "agents_md" | "cursorrules" | "json",
): string {
  if (format !== "agents_md") {
    return content;
  }

  if (shouldUseAgentsTemplateFallback(content)) {
    return DEFAULT_AGENTS_MD_TEMPLATE;
  }

  return content;
}

export const cliInternals = {
  DEFAULT_AGENTS_MD_TEMPLATE,
  wrapForTool,
  resolveExportResultContent,
  shouldUseAgentsTemplateFallback,
  normalizeExportContent,
};

async function getClient(): Promise<ApiClient> {
  const resolved = await loadConfigForCwd();
  if (!resolved) {
    console.error(red("Authentication or MCP org/project config is missing."));
    console.error(yellow(
      'Run "memctl auth" and "memctl init", or use "memctl config".',
    ));
    process.exit(1);
  }
  return new ApiClient({
    baseUrl: resolved.baseUrl,
    token: resolved.token,
    org: resolved.org,
    project: resolved.project,
  });
}

function printFriendlyError(error: unknown): never {
  const friendly = getFriendlyError(error);
  console.error(red(friendly.primary));
  if (friendly.hint) {
    console.error(yellow(friendly.hint));
  }
  process.exit(1);
}

function isAuthMessage(message: string): boolean {
  return (
    message.includes("invalid token") ||
    message.includes("session expired") ||
    message.includes("request failed (401)") ||
    message.includes("status 401") ||
    message.includes("unauthorized")
  );
}

function isNetworkMessage(message: string): boolean {
  return (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("etimedout")
  );
}

function getFriendlyError(error: unknown): {
  primary: string;
  hint?: string;
  code: "auth" | "access" | "network" | "server" | "rate_limit" | "other";
} {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        primary: "Invalid token.",
        hint: "Run `memctl auth` or `memctl config`.",
        code: "auth",
      };
    }
    if (error.status === 403) {
      return {
        primary:
          "Access denied for this org/project. Check MEMCTL_ORG and MEMCTL_PROJECT.",
        code: "access",
      };
    }
    if (error.status === 429) {
      return {
        primary: "Rate limit exceeded. Wait and retry.",
        code: "rate_limit",
      };
    }
    if (error.status >= 500) {
      return {
        primary: "memctl API is currently unavailable. Try again shortly.",
        code: "server",
      };
    }
    if (error.status === 400) {
      return {
        primary: "Invalid request. Check command arguments and try again.",
        code: "other",
      };
    }
    if (error.status === 404) {
      return {
        primary: "Requested resource was not found.",
        code: "other",
      };
    }
    return {
      primary: error.message || `Request failed (${error.status}).`,
      code: "other",
    };
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    const lower = message.toLowerCase();
    if (isAuthMessage(lower)) {
      return {
        primary: "Invalid token.",
        hint: "Run `memctl auth` or `memctl config`.",
        code: "auth",
      };
    }
    if (isNetworkMessage(lower)) {
      return {
        primary: "Could not reach API. Check MEMCTL_API_URL.",
        code: "network",
      };
    }
    return {
      primary: message || "Unexpected error.",
      code: "other",
    };
  }

  const message = String(error ?? "").trim();
  const lower = message.toLowerCase();
  if (isAuthMessage(lower)) {
    return {
      primary: "Invalid token.",
      hint: "Run `memctl auth` or `memctl config`.",
      code: "auth",
    };
  }
  if (isNetworkMessage(lower)) {
    return {
      primary: "Could not reach API. Check MEMCTL_API_URL.",
      code: "network",
    };
  }
  return {
    primary: message || "Unexpected error.",
    code: "other",
  };
}

function printUsage() {
  console.log(`memctl - Memory management CLI for AI coding agents

Usage:
  memctl serve              Start the MCP server (default)
  memctl auth               Authenticate and store your API token
  memctl init               Interactive setup wizard
  memctl init --claude      Write Claude Code MCP config only
  memctl init --cursor      Write Cursor MCP config only
  memctl init --windsurf    Write Windsurf MCP config only
  memctl init --vscode      Write VS Code MCP config only
  memctl init --codex       Write Codex MCP config only
  memctl init --roo         Write Roo Code MCP config only
  memctl init --amazonq     Write Amazon Q MCP config only
  memctl init --opencode    Write OpenCode MCP config only
  memctl init --all         Write all IDE/agent configs
  memctl config             Update API URL/token
  memctl config --show      Show resolved configuration
  memctl config --global    Update global API URL/token only
  memctl doctor             Run diagnostics
  memctl whoami             Show current config and identity
  memctl status             Show connection status and capacity
  memctl version            Show CLI version
  memctl list [options]     List memories
  memctl get <key>          Get a memory by key
  memctl search <query>     Search memories
  memctl delete <key>       Delete a memory (prompts for confirmation)
  memctl pin <key>          Pin a memory
  memctl unpin <key>        Unpin a memory
  memctl archive <key>      Archive a memory
  memctl unarchive <key>    Unarchive a memory
  memctl export [format]    Export memories (agents_md | cursorrules | json)
  memctl generate               Write AGENTS.md to current directory
  memctl generate --claude      Also write CLAUDE.md
  memctl generate --claude-rule Also write .claude/rules/memctl.md
  memctl generate --gemini      Also write GEMINI.md
  memctl generate --cursor      Also write .cursorrules
  memctl generate --cursor-rule Also write .cursor/rules/memctl.mdc
  memctl generate --copilot     Also write .github/copilot-instructions.md
  memctl generate --windsurf    Also write .windsurf/rules/memctl.md
  memctl generate --cline       Also write .clinerules/memctl.md
  memctl generate --roo         Also write .roo/rules/memctl.md
  memctl generate --codex       Also write codex.md
  memctl generate --amazonq     Also write .amazonq/rules/memctl.md
  memctl generate --opencode    Also write .opencode/instructions.md
  memctl generate --all         Write all agent config files
  memctl generate --link        Symlink agent files to AGENTS.md instead of copying
  memctl hook <action>      Hook API for cross-agent memory capture (start|turn|end)
  memctl hook-adapter       Print or write hook adapter templates for agents
  memctl import <file>      Import from .cursorrules / copilot-instructions
  memctl snapshot <name>    Create a snapshot
  memctl snapshots          List snapshots
  memctl capacity           Show memory capacity usage
  memctl cleanup            Suggest stale/expired memories for cleanup
  memctl lifecycle <...>    Run lifecycle policies
  memctl gc                 Run full garbage collection (all lifecycle policies)

Options:
  --limit <n>               Limit results (default: 50)
  --format <fmt>            Export format: agents_md, cursorrules, json (default: agents_md)
  --claude                  Include CLAUDE.md
  --claude-rule             Include .claude/rules/memctl.md
  --gemini                  Include GEMINI.md
  --cursor                  Include .cursorrules
  --cursor-rule             Include .cursor/rules/memctl.mdc
  --copilot                 Include .github/copilot-instructions.md
  --windsurf                Include .windsurf/rules/memctl.md
  --cline                   Include .clinerules/memctl.md
  --roo                     Include .roo/rules/memctl.md
  --codex                   Include codex.md
  --amazonq                 Include .amazonq/rules/memctl.md
  --opencode                Include .opencode/instructions.md
  --all                     Include all agent config files
  --link                    Symlink to AGENTS.md instead of copying
  --global                  For memctl config, update global profile only
  --json                    Output raw JSON
  --force                   Skip confirmation prompts
  --version                 Show CLI version
  --payload <json>          For hook command: JSON payload
  --stdin                   For hook command: read JSON payload from stdin
  --agent <name>            For hook-adapter: claude, cursor, windsurf, vscode, continue, zed, codex, cline, roo, amazonq, opencode, generic, all
  --dir <path>              For hook-adapter: target directory (default: .memctl/hooks)
  --write                   For hook-adapter: write files instead of printing

Environment:
  MEMCTL_TOKEN              API token (optional if stored via memctl auth)
  MEMCTL_ORG                Organization slug (or set in MCP config env)
  MEMCTL_PROJECT            Project slug (or set in MCP config env)
  MEMCTL_API_URL            API base URL (default: https://memctl.com/api/v1)
`);
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = "serve";

  let i = 0;
  if (args.length > 0 && !args[0]!.startsWith("-")) {
    command = args[0]!;
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i]!;
    if (arg === "-h" || arg === "--help") {
      flags.help = true;
      i++;
      continue;
    }
    if (arg === "--version") {
      flags.version = true;
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { command, positional, flags };
}

function out(data: unknown, json: boolean) {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function promptForValue(label: string): Promise<string> {
  const rl = await import("node:readline/promises");
  const iface = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const value = (await iface.question(`${cyan(`${label}: `)}`)).trim();
  iface.close();
  return value;
}

async function requireArg(
  value: string | undefined,
  promptLabel: string,
  usage: string,
): Promise<string> {
  if (value && value.trim()) return value.trim();
  if (isInteractiveTty()) {
    const prompted = await promptForValue(promptLabel);
    if (prompted) return prompted;
  }
  console.error(red(`Missing required value: ${promptLabel.toLowerCase()}`));
  console.error(`Usage: ${usage}`);
  process.exit(1);
}

export async function runCli(args: string[]): Promise<void> {
  const { command, positional, flags } = parseArgs(args);
  const json = Boolean(flags.json);
  const limit = flags.limit ? Number(flags.limit) : 50;

  if (
    command === "help" ||
    command === "--help" ||
    command === "-h" ||
    flags.help
  ) {
    printUsage();
    return;
  }

  if (command === "version" || flags.version) {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version: string };
    console.log(`memctl ${pkg.version}`);
    return;
  }

  if (command === "serve") {
    // Handled by index.ts - should not reach here
    return;
  }

  if (command === "init") {
    const { runInit } = await import("./init.js");
    await runInit({
      claude: Boolean(flags.claude),
      cursor: Boolean(flags.cursor),
      windsurf: Boolean(flags.windsurf),
      vscode: Boolean(flags.vscode),
      codex: Boolean(flags.codex),
      roo: Boolean(flags.roo),
      amazonq: Boolean(flags.amazonq),
      opencode: Boolean(flags.opencode),
      all: Boolean(flags.all),
    });
    return;
  }

  if (command === "auth") {
    const { runAuth } = await import("./auth.js");
    await runAuth();
    return;
  }

  if (command === "config") {
    const { runConfig } = await import("./config-command.js");
    await runConfig(flags);
    return;
  }

  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    await runDoctor();
    return;
  }

  if (command === "whoami") {
    const configPath = getConfigPath();
    const resolved = await loadConfigForCwd();
    console.log(`${bold(cyan("Configuration"))}`);
    console.log(`Config:   ${configPath}`);
    if (resolved) {
      const masked =
        resolved.token.length > 8 ? resolved.token.slice(0, 8) + "..." : "***";
      console.log(`API URL:  ${resolved.baseUrl}`);
      console.log(`Org:      ${resolved.org}`);
      console.log(`Project:  ${resolved.project}`);
      console.log(`Token:    ${masked} (${resolved.source})`);
    } else {
      console.log(`Status:   ${yellow("Not configured")}`);
      console.log(
        yellow(`Run "memctl auth" and "memctl init" to get started.`),
      );
    }
    return;
  }

  if (command === "status") {
    const resolved = await loadConfigForCwd();
    if (!resolved) {
      console.log(
        'Not configured. Run "memctl auth" and "memctl init", or use "memctl config".',
      );
      return;
    }
    console.log(`${bold(cyan("Status"))}`);
    console.log(`Org:      ${resolved.org}`);
    console.log(`Project:  ${resolved.project}`);
    console.log(`API URL:  ${resolved.baseUrl}`);
    const statusClient = new ApiClient(resolved);
    const online = await statusClient.ping();
    console.log(`Status:   ${online ? green("online") : yellow("offline")}`);
    if (online) {
      try {
        const cap = await statusClient.getMemoryCapacity();
        const pct =
          cap.usageRatio != null ? (cap.usageRatio * 100).toFixed(1) : "?";
        console.log(`Capacity: ${cap.used}/${cap.limit} (${pct}%)`);
      } catch {
        /* ignore */
      }
      try {
        const sessions = await statusClient.getSessionLogs(1);
        if (sessions.sessionLogs.length > 0) {
          const last = sessions.sessionLogs[0]!;
          const when = last.endedAt
            ? new Date(last.endedAt as string).toLocaleString()
            : "in progress";
          console.log(`Last session: ${last.sessionId} (${when})`);
        }
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (command === "hook-adapter") {
    const { runHookAdapterCommand } = await import("./hook-adapter.js");
    const result = await runHookAdapterCommand({ positional, flags });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const client = await getClient();

  try {
    switch (command) {
    case "list": {
      const result = await client.listMemories(limit, 0, {
        sort: flags.sort as string | undefined,
        includeArchived: Boolean(flags["include-archived"]),
        tags: flags.tags as string | undefined,
      });
      const data = result as { memories?: Array<Record<string, unknown>> };
      if (!json && data.memories) {
        for (const mem of data.memories) {
          const tags = mem.tags ? ` [${mem.tags}]` : "";
          const priority = mem.priority != null ? ` (p${mem.priority})` : "";
          console.log(`  ${mem.key}${priority}${tags}`);
        }
        console.log(`\n${data.memories.length} memories`);
      } else {
        out(result, true);
      }
      break;
    }

    case "get": {
      const key = await requireArg(positional[0], "Memory key", "memctl get <key>");
      const result = await client.getMemory(key);
      out(result, true);
      break;
    }

    case "search": {
      const providedQuery = positional.join(" ").trim();
      const query = providedQuery
        ? providedQuery
        : await requireArg(undefined, "Search query", "memctl search <query>");
      const result = await client.searchMemories(query, limit);
      const data = result as { memories?: Array<Record<string, unknown>> };
      if (!json && data.memories) {
        for (const mem of data.memories) {
          console.log(`  ${mem.key} - ${String(mem.content).slice(0, 80)}...`);
        }
        console.log(`\n${data.memories.length} results`);
      } else {
        out(result, true);
      }
      break;
    }

    case "export": {
      const format = (positional[0] ?? flags.format ?? "agents_md") as
        | "agents_md"
        | "cursorrules"
        | "json";
      const result = await client.exportMemories(format);
      const content = normalizeExportContent(
        resolveExportResultContent(result),
        format,
      );
      console.log(content);
      break;
    }

    case "generate": {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const all = Boolean(flags.all);
      const link = Boolean(flags.link);

      const extras: Array<{
        flag: string;
        file: string;
        format: "agents_md" | "cursorrules";
        tool: string;
      }> = [
        { flag: "claude", file: "CLAUDE.md", format: "agents_md", tool: "agents_md" },
        { flag: "claude-rule", file: ".claude/rules/memctl.md", format: "agents_md", tool: "claude_rule" },
        { flag: "gemini", file: "GEMINI.md", format: "agents_md", tool: "agents_md" },
        { flag: "cursor", file: ".cursorrules", format: "cursorrules", tool: "cursor" },
        { flag: "cursor-rule", file: ".cursor/rules/memctl.mdc", format: "agents_md", tool: "cursor_rule" },
        { flag: "copilot", file: ".github/copilot-instructions.md", format: "agents_md", tool: "copilot" },
        { flag: "windsurf", file: ".windsurf/rules/memctl.md", format: "agents_md", tool: "windsurf" },
        { flag: "cline", file: ".clinerules/memctl.md", format: "agents_md", tool: "cline" },
        { flag: "roo", file: ".roo/rules/memctl.md", format: "agents_md", tool: "roo" },
        { flag: "codex", file: "codex.md", format: "agents_md", tool: "agents_md" },
        { flag: "amazonq", file: ".amazonq/rules/memctl.md", format: "agents_md", tool: "amazonq" },
        { flag: "opencode", file: ".opencode/instructions.md", format: "agents_md", tool: "agents_md" },
      ];

      const targets: Array<{
        file: string;
        format: "agents_md" | "cursorrules";
        tool: string;
      }> = [{ file: "AGENTS.md", format: "agents_md", tool: "agents_md" }];

      for (const extra of extras) {
        if (all || flags[extra.flag]) {
          targets.push({ file: extra.file, format: extra.format, tool: extra.tool });
        }
      }

      const cache = new Map<string, string>();
      const wrote: string[] = [];
      const linked: string[] = [];

      for (const target of targets) {
        const dir = path.dirname(target.file);
        if (dir !== ".") {
          await fs.mkdir(dir, { recursive: true });
        }

        // Symlink agents_md files to AGENTS.md when --link is used
        // (skip AGENTS.md itself and .cursorrules which has a different format)
        if (link && target.file !== "AGENTS.md" && target.format === "agents_md") {
          const linkTarget = path.relative(dir, "AGENTS.md");
          // Remove existing file/symlink before creating
          await fs.rm(target.file, { force: true });
          await fs.symlink(linkTarget, target.file);
          linked.push(target.file);
          continue;
        }

        let content = cache.get(target.format);
        if (content == null) {
          const result = await client.exportMemories(target.format);
          content = normalizeExportContent(
            resolveExportResultContent(result),
            target.format,
          );
          cache.set(target.format, content);
        }

        const wrapped = wrapForTool(content, target.tool);
        await fs.writeFile(target.file, wrapped, "utf-8");
        wrote.push(target.file);
      }

      const parts: string[] = [];
      if (wrote.length > 0) {
        parts.push(`Wrote ${wrote.length} file(s): ${wrote.join(", ")}`);
      }
      if (linked.length > 0) {
        parts.push(`Linked ${linked.length} file(s): ${linked.map((f) => `${f} -> AGENTS.md`).join(", ")}`);
      }
      console.log(parts.join("\n"));
      break;
    }

    case "hook": {
      const { runHookCommand } = await import("./hooks.js");
      const result = await runHookCommand({ client, positional, flags });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "import": {
      const file = await requireArg(positional[0], "File path", "memctl import <file>");
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(file, "utf-8");
      const basename = file.split("/").pop() ?? file;

      // Parse sections from the file (headings become separate memories)
      const sections: Array<{ heading: string; content: string }> = [];
      const lines = content.split("\n");
      let currentHeading = basename;
      let currentContent: string[] = [];

      for (const line of lines) {
        const headingMatch = line.match(/^#{1,3}\s+(.+)/);
        if (headingMatch) {
          if (currentContent.length > 0) {
            sections.push({
              heading: currentHeading,
              content: currentContent.join("\n").trim(),
            });
          }
          currentHeading = headingMatch[1]!;
          currentContent = [];
        } else {
          currentContent.push(line);
        }
      }
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }

      let imported = 0;
      for (const section of sections) {
        if (!section.content) continue;
        const slug = section.heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        const key = `agent/context/imported/${slug}`;
        await client.storeMemory(key, section.content, {
          source: basename,
          heading: section.heading,
        });
        imported++;
      }
      console.log(`Imported ${imported} sections from ${basename}`);
      break;
    }

    case "snapshot": {
      const name = await requireArg(
        positional[0],
        "Snapshot name",
        "memctl snapshot <name> [--description <desc>]",
      );
      const desc = flags.description as string | undefined;
      const result = await client.createSnapshot(name, desc);
      out(result, true);
      break;
    }

    case "snapshots": {
      const result = await client.listSnapshots(limit);
      const data = result as { snapshots?: Array<Record<string, unknown>> };
      if (!json && data.snapshots) {
        for (const snap of data.snapshots) {
          console.log(
            `  ${snap.name} (${snap.memoryCount} memories) - ${snap.createdAt}`,
          );
        }
        console.log(`\n${data.snapshots.length} snapshots`);
      } else {
        out(result, true);
      }
      break;
    }

    case "capacity": {
      const result = await client.getMemoryCapacity();
      if (!json) {
        console.log(`Project: ${result.used}/${result.limit} memories`);
        if (result.usageRatio != null) {
          console.log(`Usage:   ${(result.usageRatio * 100).toFixed(1)}%`);
        }
        if (result.isFull) console.log("Status:  FULL");
        else if (result.isApproaching)
          console.log("Status:  Approaching limit");
        else console.log("Status:  OK");
      } else {
        out(result, true);
      }
      break;
    }

    case "cleanup": {
      const staleDays = flags["stale-days"] ? Number(flags["stale-days"]) : 30;
      const result = await client.suggestCleanup(staleDays, limit);
      const data = result as {
        stale?: Array<Record<string, unknown>>;
        expired?: Array<Record<string, unknown>>;
      };
      if (!json) {
        if (data.stale?.length) {
          console.log("Stale memories:");
          for (const s of data.stale) {
            console.log(`  ${s.key} - ${s.reason}`);
          }
        }
        if (data.expired?.length) {
          console.log("Expired memories:");
          for (const e of data.expired) {
            console.log(`  ${e.key} - ${e.reason}`);
          }
        }
        if (!data.stale?.length && !data.expired?.length) {
          console.log("No cleanup suggestions.");
        }
      } else {
        out(result, true);
      }
      break;
    }

    case "lifecycle": {
      const policies = positional.filter((item) => item.trim().length > 0);
      if (policies.length === 0) {
        if (isInteractiveTty()) {
          const raw = await promptForValue(
            "Policies (comma-separated, e.g. cleanup_expired,auto_prune)",
          );
          const prompted = raw
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
          if (prompted.length > 0) {
            policies.push(...prompted);
          }
        }
        if (policies.length === 0) {
          console.error("Usage: memctl lifecycle <policy1> [policy2] ...");
          console.error(
            "Policies: archive_merged_branches, cleanup_expired, cleanup_session_logs, auto_promote, auto_demote, auto_prune, auto_archive_unhealthy, cleanup_old_versions, cleanup_activity_logs, cleanup_expired_locks, purge_archived",
          );
          process.exit(1);
        }
      }
      const result = await client.runLifecycle(policies, {
        healthThreshold: flags["health-threshold"]
          ? Number(flags["health-threshold"])
          : undefined,
        sessionLogMaxAgeDays: flags["session-log-days"]
          ? Number(flags["session-log-days"])
          : undefined,
      });
      out(result, true);
      break;
    }

    case "gc": {
      const healthThreshold = flags["health-threshold"]
        ? Number(flags["health-threshold"])
        : 15;
      const sessionLogDays = flags["session-log-days"]
        ? Number(flags["session-log-days"])
        : 30;

      if (!json) console.log("Running garbage collection...\n");

      // Step 1: cleanup expired
      try {
        const cleaned = await client.cleanupExpired();
        if (!json) console.log(`  cleanup_expired: ${cleaned.cleaned} removed`);
      } catch (err) {
        const friendly = getFriendlyError(err);
        if (
          friendly.code === "auth" ||
          friendly.code === "access" ||
          friendly.code === "network"
        ) {
          printFriendlyError(err);
        }
        if (!json)
          console.log(`  cleanup_expired: error - ${friendly.primary}`);
      }

      // Step 2: run all lifecycle policies
      const allPolicies = [
        "cleanup_expired",
        "cleanup_session_logs",
        "archive_merged_branches",
        "auto_demote",
        "auto_prune",
        "auto_archive_unhealthy",
        "cleanup_old_versions",
        "cleanup_activity_logs",
        "cleanup_expired_locks",
        "purge_archived",
      ];
      try {
        const result = await client.runLifecycle(allPolicies, {
          healthThreshold,
          sessionLogMaxAgeDays: sessionLogDays,
        });
        if (json) {
          out(result, true);
        } else {
          for (const [policy, info] of Object.entries(result.results)) {
            const details = (info as { affected: number; details?: string })
              .details
              ? ` (${(info as { affected: number; details?: string }).details})`
              : "";
            console.log(
              `  ${policy}: ${(info as { affected: number }).affected} affected${details}`,
            );
          }
        }
      } catch (err) {
        const friendly = getFriendlyError(err);
        if (
          friendly.code === "auth" ||
          friendly.code === "access" ||
          friendly.code === "network"
        ) {
          printFriendlyError(err);
        }
        if (!json)
          console.log(`  lifecycle: error - ${friendly.primary}`);
      }

      // Step 3: show final capacity
      if (!json) {
        try {
          const cap = await client.getMemoryCapacity();
          console.log(
            `\nCapacity: ${cap.used}/${cap.limit} memories (${cap.usageRatio != null ? (cap.usageRatio * 100).toFixed(1) : "?"}%)`,
          );
          if (cap.isFull) console.log("Status: FULL");
          else if (cap.isApproaching) console.log("Status: Approaching limit");
          else console.log("Status: OK");
        } catch {
          /* ignore */
        }
      }
      break;
    }

    case "delete": {
      const key = await requireArg(positional[0], "Memory key", "memctl delete <key>");
      if (!flags.force) {
        const rl = await import("node:readline/promises");
        const iface = rl.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await iface.question(`Delete "${key}"? [y/N] `);
        iface.close();
        if (answer.toLowerCase() !== "y") {
          console.log(yellow("Aborted."));
          return;
        }
      }
      await client.deleteMemory(key);
      console.log(green(`Deleted: ${key}`));
      break;
    }

    case "pin":
    case "unpin": {
      const key = await requireArg(
        positional[0],
        "Memory key",
        `memctl ${command} <key>`,
      );
      const pin = command === "pin";
      const result = await client.pinMemory(key, pin);
      if (json) {
        out(result, true);
      } else {
        console.log(green(`${pin ? "Pinned" : "Unpinned"}: ${key}`));
      }
      break;
    }

    case "archive":
    case "unarchive": {
      const key = await requireArg(
        positional[0],
        "Memory key",
        `memctl ${command} <key>`,
      );
      const archive = command === "archive";
      const result = await client.archiveMemory(key, archive);
      if (json) {
        out(result, true);
      } else {
        console.log(green(`${archive ? "Archived" : "Unarchived"}: ${key}`));
      }
      break;
    }

      default:
        console.error(red(`Unknown command: ${command}`));
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    printFriendlyError(error);
  }
}
