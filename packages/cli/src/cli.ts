import { ApiClient } from "./api-client.js";

function getClient(): ApiClient {
  const baseUrl = process.env.MEMCTL_API_URL ?? "https://memctl.com/api/v1";
  const token = process.env.MEMCTL_TOKEN;
  const org = process.env.MEMCTL_ORG;
  const project = process.env.MEMCTL_PROJECT;

  if (!token) {
    console.error("Error: MEMCTL_TOKEN is required");
    console.error("Set it via: export MEMCTL_TOKEN=your-token");
    process.exit(1);
  }
  if (!org) {
    console.error("Error: MEMCTL_ORG is required");
    console.error("Set it via: export MEMCTL_ORG=your-org-slug");
    process.exit(1);
  }
  if (!project) {
    console.error("Error: MEMCTL_PROJECT is required");
    console.error("Set it via: export MEMCTL_PROJECT=your-project-slug");
    process.exit(1);
  }

  return new ApiClient({ baseUrl, token, org, project });
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
  memctl init --all         Write all IDE configs
  memctl doctor             Run diagnostics
  memctl list [options]     List memories
  memctl get <key>          Get a memory by key
  memctl search <query>     Search memories
  memctl export [format]    Export memories (agents_md | cursorrules | json)
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
  --json                    Output raw JSON

Environment:
  MEMCTL_TOKEN              API token (required, or use memctl init)
  MEMCTL_ORG                Organization slug (required, or use memctl init)
  MEMCTL_PROJECT            Project slug (required, or use memctl init)
  MEMCTL_API_URL            API base URL (default: https://memctl.com/api/v1)
`);
}

function parseArgs(args: string[]): { command: string; positional: string[]; flags: Record<string, string | boolean> } {
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

export async function runCli(args: string[]): Promise<void> {
  const { command, positional, flags } = parseArgs(args);
  const json = Boolean(flags.json);
  const limit = flags.limit ? Number(flags.limit) : 50;

  if (command === "help" || command === "--help" || command === "-h") {
    printUsage();
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
      all: Boolean(flags.all),
    });
    return;
  }

  if (command === "auth") {
    const { runAuth } = await import("./auth.js");
    await runAuth();
    return;
  }

  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    await runDoctor();
    return;
  }

  const client = getClient();

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
      const key = positional[0];
      if (!key) {
        console.error("Usage: memctl get <key>");
        process.exit(1);
      }
      const result = await client.getMemory(key);
      out(result, true);
      break;
    }

    case "search": {
      const query = positional.join(" ");
      if (!query) {
        console.error("Usage: memctl search <query>");
        process.exit(1);
      }
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
      const format = (positional[0] ?? flags.format ?? "agents_md") as "agents_md" | "cursorrules" | "json";
      const result = await client.exportMemories(format);
      if (typeof result === "string") {
        console.log(result);
      } else {
        const data = result as Record<string, unknown>;
        if (typeof data.content === "string") {
          console.log(data.content);
        } else {
          out(result, true);
        }
      }
      break;
    }

    case "import": {
      const file = positional[0];
      if (!file) {
        console.error("Usage: memctl import <file>");
        process.exit(1);
      }
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
            sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
          }
          currentHeading = headingMatch[1]!;
          currentContent = [];
        } else {
          currentContent.push(line);
        }
      }
      if (currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join("\n").trim() });
      }

      let imported = 0;
      for (const section of sections) {
        if (!section.content) continue;
        const slug = section.heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        const key = `agent/context/imported/${slug}`;
        await client.storeMemory(key, section.content, { source: basename, heading: section.heading });
        imported++;
      }
      console.log(`Imported ${imported} sections from ${basename}`);
      break;
    }

    case "snapshot": {
      const name = positional[0];
      if (!name) {
        console.error("Usage: memctl snapshot <name> [--description <desc>]");
        process.exit(1);
      }
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
          console.log(`  ${snap.name} (${snap.memoryCount} memories) - ${snap.createdAt}`);
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
        console.log(`Org:     ${result.orgUsed}/${result.orgLimit} memories`);
        if (result.usageRatio != null) {
          console.log(`Usage:   ${(result.usageRatio * 100).toFixed(1)}%`);
        }
        if (result.isFull) console.log("Status:  FULL");
        else if (result.isApproaching) console.log("Status:  Approaching limit");
        else console.log("Status:  OK");
      } else {
        out(result, true);
      }
      break;
    }

    case "cleanup": {
      const staleDays = flags["stale-days"] ? Number(flags["stale-days"]) : 30;
      const result = await client.suggestCleanup(staleDays, limit);
      const data = result as { stale?: Array<Record<string, unknown>>; expired?: Array<Record<string, unknown>> };
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
      const policies = positional;
      if (policies.length === 0) {
        console.error("Usage: memctl lifecycle <policy1> [policy2] ...");
        console.error("Policies: archive_merged_branches, cleanup_expired, cleanup_session_logs, auto_promote, auto_demote, auto_prune, auto_archive_unhealthy, cleanup_old_versions, cleanup_activity_logs, cleanup_expired_locks, purge_archived");
        process.exit(1);
      }
      const result = await client.runLifecycle(policies, {
        healthThreshold: flags["health-threshold"] ? Number(flags["health-threshold"]) : undefined,
        sessionLogMaxAgeDays: flags["session-log-days"] ? Number(flags["session-log-days"]) : undefined,
      });
      out(result, true);
      break;
    }

    case "gc": {
      const healthThreshold = flags["health-threshold"] ? Number(flags["health-threshold"]) : 15;
      const sessionLogDays = flags["session-log-days"] ? Number(flags["session-log-days"]) : 30;

      if (!json) console.log("Running garbage collection...\n");

      // Step 1: cleanup expired
      try {
        const cleaned = await client.cleanupExpired();
        if (!json) console.log(`  cleanup_expired: ${cleaned.cleaned} removed`);
      } catch (err) {
        if (!json) console.log(`  cleanup_expired: error - ${err instanceof Error ? err.message : String(err)}`);
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
            const details = (info as { affected: number; details?: string }).details ? ` (${(info as { affected: number; details?: string }).details})` : "";
            console.log(`  ${policy}: ${(info as { affected: number }).affected} affected${details}`);
          }
        }
      } catch (err) {
        if (!json) console.log(`  lifecycle: error - ${err instanceof Error ? err.message : String(err)}`);
      }

      // Step 3: show final capacity
      if (!json) {
        try {
          const cap = await client.getMemoryCapacity();
          console.log(`\nCapacity: ${cap.used}/${cap.limit} memories (${cap.usageRatio != null ? (cap.usageRatio * 100).toFixed(1) : "?"}%)`);
          if (cap.isFull) console.log("Status: FULL");
          else if (cap.isApproaching) console.log("Status: Approaching limit");
          else console.log("Status: OK");
        } catch { /* ignore */ }
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}
