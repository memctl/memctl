import { readFile, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, loadConfigForCwd, getConfigPath, getConfigDir } from "./config.js";
import { ApiClient } from "./api-client.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

type Status = "pass" | "warn" | "fail";

function icon(status: Status): string {
  if (status === "pass") return `${GREEN}\u2713${RESET}`;
  if (status === "warn") return `${YELLOW}!${RESET}`;
  return `${RED}\u2717${RESET}`;
}

function line(status: Status, label: string, detail?: string) {
  const detailStr = detail ? `${DIM} ${detail}${RESET}` : "";
  console.log(`  ${icon(status)} ${label}${detailStr}`);
}

export async function runDoctor(): Promise<void> {
  console.log("\n  memctl doctor\n");

  let passed = 0;
  let warned = 0;
  let failed = 0;

  function track(status: Status) {
    if (status === "pass") passed++;
    else if (status === "warn") warned++;
    else failed++;
  }

  // 1. Config file exists
  const configPath = getConfigPath();
  const config = await loadConfig();
  if (config) {
    line("pass", "Config file", configPath);
    track("pass");
  } else {
    line("warn", "Config file", `Not found at ${configPath}. Using env vars only.`);
    track("warn");
  }

  // 2. Environment variables or config resolves
  const resolved = await loadConfigForCwd();
  if (resolved) {
    line("pass", "Credentials resolved", resolved.baseUrl);
    track("pass");
  } else {
    line("fail", "Credentials", "Neither env vars nor config file provide token/org/project");
    track("fail");
    // Can't continue without credentials
    printSummary(passed, warned, failed);
    return;
  }

  // 3. API connectivity
  let apiOnline = false;
  try {
    const res = await fetch(`${resolved.baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      line("pass", "API connectivity", `${resolved.baseUrl}/health`);
      track("pass");
      apiOnline = true;
    } else {
      line("fail", "API connectivity", `HTTP ${res.status}`);
      track("fail");
    }
  } catch (err) {
    line("fail", "API connectivity", err instanceof Error ? err.message : "unreachable");
    track("fail");
  }

  // 4. Auth token validity
  if (apiOnline) {
    const client = new ApiClient(resolved);
    try {
      const pingOk = await client.ping();
      if (pingOk) {
        line("pass", "Auth token valid");
        track("pass");
      } else {
        line("fail", "Auth token", "Ping returned false");
        track("fail");
      }
    } catch (err) {
      line("fail", "Auth token", err instanceof Error ? err.message : "invalid");
      track("fail");
    }

    // 5. Org/project access - check capacity
    try {
      const capacity = await client.getMemoryCapacity();
      line("pass", "Org/project access", `${capacity.used}/${capacity.limit} memories used`);
      track("pass");

      // 7. Memory capacity warnings
      if (capacity.isFull) {
        line("fail", "Memory capacity", "FULL — delete or archive memories");
        track("fail");
      } else if (capacity.isApproaching) {
        line("warn", "Memory capacity", `${Math.round((capacity.usageRatio ?? 0) * 100)}% used`);
        track("warn");
      } else {
        line("pass", "Memory capacity", `${Math.round((capacity.usageRatio ?? 0) * 100)}% used`);
        track("pass");
      }
    } catch (err) {
      line("fail", "Org/project access", err instanceof Error ? err.message : "denied");
      track("fail");
    }
  }

  // 6. Local cache
  const cacheDir = getConfigDir();
  const cachePath = join(cacheDir, "cache.db");
  try {
    await access(cachePath, constants.R_OK);
    line("pass", "Local cache", cachePath);
    track("pass");
  } catch {
    line("warn", "Local cache", "No cache.db found (will be created on first use)");
    track("warn");
  }

  // 8. Pending writes queue
  const pendingPath = join(cacheDir, "pending-writes.json");
  try {
    const raw = await readFile(pendingPath, "utf-8");
    const pending = JSON.parse(raw) as unknown[];
    if (pending.length > 0) {
      line("warn", "Pending writes", `${pending.length} write(s) queued for sync`);
      track("warn");
    } else {
      line("pass", "Pending writes", "Queue empty");
      track("pass");
    }
  } catch {
    line("pass", "Pending writes", "No pending writes");
    track("pass");
  }

  printSummary(passed, warned, failed);
}

function printSummary(passed: number, warned: number, failed: number) {
  console.log("");
  const parts: string[] = [];
  if (passed > 0) parts.push(`${GREEN}${passed} passed${RESET}`);
  if (warned > 0) parts.push(`${YELLOW}${warned} warnings${RESET}`);
  if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
  console.log(`  ${parts.join(", ")}\n`);
}
