import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface MemctlProfile {
  token: string;
  apiUrl: string;
}

export interface MemctlProjectConfig {
  org: string;
  project: string;
  profile: string;
}

export interface MemctlConfig {
  profiles: Record<string, MemctlProfile>;
  projects?: Record<string, MemctlProjectConfig>;
}

const CONFIG_DIR = join(homedir(), ".memctl");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const DEFAULT_API_URL = "https://memctl.com/api/v1";
const VALID_SLUG_RE = /^[A-Za-z0-9._-]+$/;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<MemctlConfig | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MemctlConfig>;
    return {
      profiles: parsed.profiles ?? {},
      projects: parsed.projects ?? {},
    };
  } catch {
    return null;
  }
}

export async function saveConfig(config: MemctlConfig): Promise<void> {
  const next: MemctlConfig = { profiles: config.profiles ?? {} };
  const projects = config.projects ?? {};
  if (Object.keys(projects).length > 0) {
    next.projects = projects;
  }
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n");
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeSlug(value: unknown): string | null {
  const parsed = asString(value);
  if (!parsed || !VALID_SLUG_RE.test(parsed)) return null;
  return parsed;
}

function normalizeApiUrl(value: unknown): string | null {
  const parsed = asString(value);
  return parsed || null;
}

function normalizeToken(value: unknown): string | null {
  const parsed = asString(value);
  return parsed || null;
}

export async function loadMcpEnvForCwd(
  cwd: string,
): Promise<{
  org: string;
  project: string;
  apiUrl: string | null;
  token: string | null;
} | null> {
  const candidates = [
    join(cwd, ".mcp.json"),
    join(cwd, ".claude", "mcp.json"),
    join(cwd, ".cursor", "mcp.json"),
  ];

  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf-8");
      const parsed = JSON.parse(raw) as {
        mcpServers?: Record<string, unknown>;
      };
      const servers = parsed.mcpServers;
      if (!servers || typeof servers !== "object") continue;

      let memctlEntry: Record<string, unknown> | null = null;
      const namedEntry = servers.memctl;
      if (namedEntry && typeof namedEntry === "object") {
        memctlEntry = namedEntry as Record<string, unknown>;
      }

      if (!memctlEntry) {
        for (const value of Object.values(servers)) {
          if (!value || typeof value !== "object") continue;
          const entry = value as Record<string, unknown>;
          const args = Array.isArray(entry.args) ? entry.args : [];
          const hasMemctlArg = args.some(
            (arg) => typeof arg === "string" && arg.includes("memctl"),
          );
          if (hasMemctlArg) {
            memctlEntry = entry;
            break;
          }
        }
      }

      if (!memctlEntry) continue;
      const envRaw = memctlEntry.env;
      if (!envRaw || typeof envRaw !== "object") continue;

      const env = envRaw as Record<string, unknown>;
      const org = normalizeSlug(env.MEMCTL_ORG);
      const project = normalizeSlug(env.MEMCTL_PROJECT);
      if (!org || !project) continue;

      return {
        org,
        project,
        apiUrl: normalizeApiUrl(env.MEMCTL_API_URL),
        token: normalizeToken(env.MEMCTL_TOKEN),
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Resolve config for the current working directory.
 * Priority: environment variables > MCP config > env org/project + profile.
 *
 * After `memctl auth`, the token is stored in ~/.memctl/config.json under the
 * default profile. MCP configs then only need MEMCTL_ORG and MEMCTL_PROJECT —
 * the token is resolved from the config file automatically.
 */
export async function loadConfigForCwd(): Promise<{
  baseUrl: string;
  token: string;
  org: string;
  project: string;
  source: "env" | "mcp" | "env+profile";
} | null> {
  const envToken = normalizeToken(process.env.MEMCTL_TOKEN);
  const envOrg = normalizeSlug(process.env.MEMCTL_ORG);
  const envProject = normalizeSlug(process.env.MEMCTL_PROJECT);
  const envUrl = normalizeApiUrl(process.env.MEMCTL_API_URL);

  // All three env vars set — use them directly
  if (envToken && envOrg && envProject) {
    return {
      baseUrl: envUrl ?? DEFAULT_API_URL,
      token: envToken,
      org: envOrg,
      project: envProject,
      source: "env",
    };
  }

  // Fall back to config file
  const config = await loadConfig();
  const cwd = resolve(process.cwd());
  const mcpEnv = await loadMcpEnvForCwd(cwd);

  const defaultProfile = config?.profiles.default;
  const defaultToken = normalizeToken(defaultProfile?.token);
  const defaultApiUrl = normalizeApiUrl(defaultProfile?.apiUrl);

  if (mcpEnv) {
    const token = envToken ?? mcpEnv.token ?? defaultToken;
    if (token) {
      const org = envOrg ?? mcpEnv.org;
      const project = envProject ?? mcpEnv.project;
      if (org && project) {
        return {
          baseUrl: envUrl ?? mcpEnv.apiUrl ?? defaultApiUrl ?? DEFAULT_API_URL,
          token,
          org,
          project,
          source: "mcp",
        };
      }
    }
  }

  // If org+project are set via env but token is not, pull token from
  // the default profile (set by `memctl auth`)
  if (envOrg && envProject && defaultToken) {
    return {
      baseUrl: envUrl ?? defaultApiUrl ?? DEFAULT_API_URL,
      token: defaultToken,
      org: envOrg,
      project: envProject,
      source: "env+profile",
    };
  }

  return null;
}
