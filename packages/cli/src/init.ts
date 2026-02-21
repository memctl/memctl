import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import {
  loadConfig,
  saveConfig,
  type MemctlConfig,
} from "./config.js";

const execFileAsync = promisify(execFile);

interface InitFlags {
  claude?: boolean;
  cursor?: boolean;
  windsurf?: boolean;
  all?: boolean;
}

export async function runInit(flags: InitFlags): Promise<void> {
  // If an IDE flag is given, skip the full wizard and just write IDE config
  if (flags.claude || flags.cursor || flags.windsurf || flags.all) {
    await writeIdeConfigs(flags);
    return;
  }

  // Full interactive wizard
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\n  memctl setup wizard\n");

    // 1. Detect project
    let detectedProject = "";
    let detectedOrg = "";
    try {
      const result = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: process.cwd() });
      const url = result.stdout.trim();
      const match = url.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (match) {
        detectedOrg = match[1]!;
        detectedProject = match[2]!;
      }
    } catch { /* ignore */ }

    // 2. API token
    const token = await rl.question("  API token: ");
    if (!token.trim()) {
      console.error("  Token is required. Aborting.");
      return;
    }

    // 3. API URL
    const defaultUrl = "https://memctl.com/api/v1";
    const apiUrlInput = await rl.question(`  API URL [${defaultUrl}]: `);
    const apiUrl = apiUrlInput.trim() || defaultUrl;

    // 4. Test connectivity
    console.log("  Testing connectivity...");
    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log("  Connected successfully.\n");
      } else {
        console.warn(`  Warning: API returned ${res.status}. Continuing anyway.\n`);
      }
    } catch {
      console.warn("  Warning: Could not reach API. Continuing anyway.\n");
    }

    // 5. Org slug
    const orgPrompt = detectedOrg ? `  Organization slug [${detectedOrg}]: ` : "  Organization slug: ";
    const orgInput = await rl.question(orgPrompt);
    const org = orgInput.trim() || detectedOrg;
    if (!org) {
      console.error("  Organization slug is required. Aborting.");
      return;
    }

    // 6. Project slug
    const projectPrompt = detectedProject ? `  Project slug [${detectedProject}]: ` : "  Project slug: ";
    const projectInput = await rl.question(projectPrompt);
    const project = projectInput.trim() || detectedProject;
    if (!project) {
      console.error("  Project slug is required. Aborting.");
      return;
    }

    // 7. Save to config file
    const config: MemctlConfig = (await loadConfig()) ?? { profiles: {}, projects: {} };
    config.profiles.default = { token, apiUrl };
    config.projects[resolve(process.cwd())] = { org, project, profile: "default" };
    await saveConfig(config);
    console.log("  Config saved to ~/.memctl/config.json\n");

    // 8. Ask which IDE to configure
    const ideInput = await rl.question("  Configure IDE? (claude/cursor/windsurf/all/none) [none]: ");
    const ide = ideInput.trim().toLowerCase() || "none";

    if (ide !== "none") {
      const ideFlags: InitFlags = {
        claude: ide === "claude" || ide === "all",
        cursor: ide === "cursor" || ide === "all",
        windsurf: ide === "windsurf" || ide === "all",
      };
      await writeIdeConfigs(ideFlags, { token, apiUrl, org, project });
    }

    console.log("  Setup complete!\n");
  } finally {
    rl.close();
  }
}

interface ResolvedConfig {
  token: string;
  apiUrl: string;
  org: string;
  project: string;
}

async function resolveConfig(): Promise<ResolvedConfig | null> {
  const config = await loadConfig();
  if (!config) return null;

  const cwd = resolve(process.cwd());
  const projectConfig = config.projects[cwd];
  if (!projectConfig) return null;

  const profile = config.profiles[projectConfig.profile];
  if (!profile) return null;

  return {
    token: profile.token,
    apiUrl: profile.apiUrl,
    org: projectConfig.org,
    project: projectConfig.project,
  };
}

async function writeIdeConfigs(flags: InitFlags, overrideConfig?: ResolvedConfig): Promise<void> {
  const config = overrideConfig ?? (await resolveConfig());
  if (!config) {
    console.error("  No config found. Run `memctl init` first to set up credentials.");
    process.exit(1);
  }

  const mcpEntry = {
    command: "npx",
    args: ["-y", "memctl@latest"],
    env: {
      MEMCTL_TOKEN: config.token,
      MEMCTL_API_URL: config.apiUrl,
      MEMCTL_ORG: config.org,
      MEMCTL_PROJECT: config.project,
    },
  };

  if (flags.claude || flags.all) {
    await writeJsonConfig(
      join(process.cwd(), ".claude", "mcp.json"),
      { mcpServers: { memctl: mcpEntry } },
      "Claude Code",
    );
  }

  if (flags.cursor || flags.all) {
    await writeJsonConfig(
      join(process.cwd(), ".cursor", "mcp.json"),
      { mcpServers: { memctl: mcpEntry } },
      "Cursor",
    );
  }

  if (flags.windsurf || flags.all) {
    await writeJsonConfig(
      join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
      { mcpServers: { memctl: mcpEntry } },
      "Windsurf",
    );
  }
}

async function writeJsonConfig(path: string, data: Record<string, unknown>, ideName: string): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });

  // Merge with existing config if present
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(path, "utf-8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch { /* ignore */ }

  const merged = {
    ...existing,
    mcpServers: {
      ...((existing.mcpServers as Record<string, unknown>) ?? {}),
      ...((data.mcpServers as Record<string, unknown>) ?? {}),
    },
  };

  await writeFile(path, JSON.stringify(merged, null, 2) + "\n");
  console.log(`  ${ideName}: ${path}`);
}
