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
  projects: Record<string, MemctlProjectConfig>;
}

const CONFIG_DIR = join(homedir(), ".memctl");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<MemctlConfig | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as MemctlConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: MemctlConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Resolve config for the current working directory.
 * Priority: environment variables > project config > default profile.
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
} | null> {
  const envToken = process.env.MEMCTL_TOKEN;
  const envOrg = process.env.MEMCTL_ORG;
  const envProject = process.env.MEMCTL_PROJECT;
  const envUrl = process.env.MEMCTL_API_URL;

  // All three env vars set — use them directly
  if (envToken && envOrg && envProject) {
    return {
      baseUrl: envUrl ?? "https://memctl.com/api/v1",
      token: envToken,
      org: envOrg,
      project: envProject,
    };
  }

  // Fall back to config file
  const config = await loadConfig();
  if (!config) return null;

  const cwd = resolve(process.cwd());
  const projectConfig = config.projects[cwd];

  // If we have a project mapping for this directory, use it
  if (projectConfig) {
    const profile = config.profiles[projectConfig.profile];
    if (!profile) return null;

    return {
      baseUrl: envUrl ?? profile.apiUrl,
      token: envToken ?? profile.token,
      org: envOrg ?? projectConfig.org,
      project: envProject ?? projectConfig.project,
    };
  }

  // If org+project are set via env but token is not, pull token from
  // the default profile (set by `memctl auth`)
  if (envOrg && envProject) {
    const defaultProfile = config.profiles.default;
    if (defaultProfile) {
      return {
        baseUrl: envUrl ?? defaultProfile.apiUrl,
        token: defaultProfile.token,
        org: envOrg,
        project: envProject,
      };
    }
  }

  return null;
}
