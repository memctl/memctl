import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import {
  loadConfig,
  loadMcpEnvForCwd,
  saveConfig,
  type MemctlConfig,
} from "./config.js";
import { bold, cyan, green, red, yellow } from "./ui.js";

const execFileAsync = promisify(execFile);

interface InitFlags {
  claude?: boolean;
  cursor?: boolean;
  windsurf?: boolean;
  all?: boolean;
}

interface IdeWriteOptions {
  omitToken?: boolean;
}
const VALID_SLUG_RE = /^[A-Za-z0-9._-]+$/;

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !VALID_SLUG_RE.test(trimmed)) return null;
  return trimmed;
}

function asDefaultText(value: string): string {
  return value ? ` [${value}]` : "";
}

async function promptRequired(
  rl: ReturnType<typeof createInterface>,
  label: string,
  fallback = "",
): Promise<string> {
  while (true) {
    const answer = await rl.question(`  ${label}${asDefaultText(fallback)}: `);
    const value = answer.trim() || fallback;
    if (value) return value;
    console.error(`  ${red(`${label} is required.`)}`);
  }
}

async function promptSlug(
  rl: ReturnType<typeof createInterface>,
  label: string,
  fallback = "",
): Promise<string> {
  while (true) {
    const value = await promptRequired(rl, label, fallback);
    if (VALID_SLUG_RE.test(value)) return value;
    console.error(
      `  ${red(`${label} must use letters, numbers, dots, underscores, or hyphens.`)}`,
    );
  }
}

async function promptYesNo(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: boolean,
): Promise<boolean> {
  const hint = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`  ${label} [${hint}]: `))
    .trim()
    .toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

function ideChoiceToFlags(choice: string): InitFlags {
  const value = choice.trim().toLowerCase();
  if (value === "2" || value === "claude") {
    return { claude: true };
  }
  if (value === "3" || value === "cursor") {
    return { cursor: true };
  }
  if (value === "4" || value === "windsurf") {
    return { windsurf: true };
  }
  if (
    value === "5" ||
    value === "claude+cursor" ||
    value === "claude-cursor"
  ) {
    return { claude: true, cursor: true };
  }
  if (value === "6" || value === "all") {
    return { all: true };
  }
  return {};
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
    console.log(`\n  ${bold(cyan("memctl onboarding"))}\n`);

    let detectedProject = "";
    let detectedOrg = "";
    try {
      const result = await execFileAsync(
        "git",
        ["remote", "get-url", "origin"],
        { cwd: process.cwd() },
      );
      const url = result.stdout.trim();
      const match = url.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (match) {
        detectedOrg = match[1]!;
        detectedProject = match[2]!;
      }
    } catch {
      /* ignore */
    }

    const existingConfig: MemctlConfig = (await loadConfig()) ?? {
      profiles: {},
    };
    const existingProfile = existingConfig.profiles.default;
    const cwd = resolve(process.cwd());
    const existingMcpEnv = await loadMcpEnvForCwd(cwd);
    const defaultUrl = existingProfile?.apiUrl || "https://memctl.com/api/v1";

    console.log(`  ${cyan("Step 1/4: Authentication")}`);
    let token = "";
    let apiUrl = defaultUrl;

    if (existingProfile?.token) {
      const useSaved = await promptYesNo(
        rl,
        "Use saved token from memctl auth",
        true,
      );
      if (useSaved) {
        token = existingProfile.token;
      }
    }

    if (!token) {
      apiUrl = await promptRequired(rl, "API URL", defaultUrl);
      console.log(
        "\n  Get your API token from: https://memctl.com → Settings → API Tokens\n",
      );
      token = await promptRequired(rl, "API token");
    }

    console.log("  Testing connectivity...");
    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log(`  ${green("Connected successfully.")}\n`);
      } else {
        console.warn(
          `  ${yellow(`Warning: API returned ${res.status}. Continuing anyway.`)}\n`,
        );
      }
    } catch {
      console.warn(
        `  ${yellow("Warning: Could not reach API. Continuing anyway.")}\n`,
      );
    }

    console.log(`  ${cyan("Step 2/4: Project mapping")}`);
    const orgDefault =
      normalizeSlug(process.env.MEMCTL_ORG) ||
      existingMcpEnv?.org ||
      detectedOrg;
    const projectDefault =
      normalizeSlug(process.env.MEMCTL_PROJECT) ||
      existingMcpEnv?.project ||
      detectedProject;

    const org = await promptSlug(rl, "Organization slug", orgDefault);
    const project = await promptSlug(rl, "Project slug", projectDefault);

    console.log(`\n  ${cyan("Step 3/4: Save config")}`);
    console.log(`  API URL:  ${apiUrl}`);
    console.log(`  Org:      ${org}`);
    console.log(`  Project:  ${project}`);

    const shouldSave = await promptYesNo(
      rl,
      "Write this to ~/.memctl/config.json",
      true,
    );
    if (!shouldSave) {
      console.log(`  ${yellow("Aborted.")}\n`);
      return;
    }

    existingConfig.profiles.default = { token, apiUrl };
    existingConfig.projects = {};
    await saveConfig(existingConfig);
    console.log(
      `  ${green("Credentials saved")} to ~/.memctl/config.json (org/project are stored in MCP config only)\n`,
    );

    console.log(`  ${cyan("Step 4/4: MCP config")}`);
    console.log("  Choose where to write MCP config:");
    console.log("    1) none");
    console.log("    2) claude");
    console.log("    3) cursor");
    console.log("    4) windsurf");
    console.log("    5) claude+cursor");
    console.log("    6) all");

    const ideInput = await rl.question(
      "  Selection [1]: ",
    );
    const ideFlags = ideChoiceToFlags(ideInput || "1");

    if (ideFlags.claude || ideFlags.cursor || ideFlags.windsurf || ideFlags.all) {
      const includeTokenInIdeConfig = await promptYesNo(
        rl,
        "Include API token in MCP config env",
        false,
      );
      await writeIdeConfigs(
        ideFlags,
        { token, apiUrl, org, project },
        { omitToken: !includeTokenInIdeConfig },
      );
    }

    console.log(`  ${green("Setup complete!")}\n`);
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

  const defaultProfile = config.profiles.default;
  if (!defaultProfile?.token) return null;

  const cwd = resolve(process.cwd());
  const mcpEnv = await loadMcpEnvForCwd(cwd);
  const legacyProject = config.projects?.[cwd];
  const envOrg = normalizeSlug(process.env.MEMCTL_ORG);
  const envProject = normalizeSlug(process.env.MEMCTL_PROJECT);
  const org =
    envOrg || mcpEnv?.org || normalizeSlug(legacyProject?.org);
  const project =
    envProject || mcpEnv?.project || normalizeSlug(legacyProject?.project);
  if (!org || !project) return null;

  return {
    token: defaultProfile.token,
    apiUrl: defaultProfile.apiUrl || "https://memctl.com/api/v1",
    org,
    project,
  };
}

async function writeIdeConfigs(
  flags: InitFlags,
  overrideConfig?: ResolvedConfig,
  options?: IdeWriteOptions,
): Promise<void> {
  const config = overrideConfig ?? (await resolveConfig());
  if (!config) {
    console.error(
      `  ${red("No config found.")} Run \`memctl init\` and set MEMCTL_ORG/MEMCTL_PROJECT in MCP config env first.`,
    );
    process.exit(1);
  }

  const mcpEntry = {
    command: "npx",
    args: ["-y", "memctl@latest"],
    env: {
      MEMCTL_API_URL: config.apiUrl,
      MEMCTL_ORG: config.org,
      MEMCTL_PROJECT: config.project,
      ...(options?.omitToken ? {} : { MEMCTL_TOKEN: config.token }),
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

async function writeJsonConfig(
  path: string,
  data: Record<string, unknown>,
  ideName: string,
): Promise<void> {
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });

  // Merge with existing config if present
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(path, "utf-8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

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
