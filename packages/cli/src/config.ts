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
 */
export async function loadConfigForCwd(): Promise<{
  baseUrl: string;
  token: string;
  org: string;
  project: string;
} | null> {
  // Environment variables take priority
  const envToken = process.env.MEMCTL_TOKEN;
  const envOrg = process.env.MEMCTL_ORG;
  const envProject = process.env.MEMCTL_PROJECT;
  const envUrl = process.env.MEMCTL_API_URL;

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
  if (!projectConfig) return null;

  const profile = config.profiles[projectConfig.profile];
  if (!profile) return null;

  return {
    baseUrl: envUrl ?? profile.apiUrl,
    token: envToken ?? profile.token,
    org: envOrg ?? projectConfig.org,
    project: envProject ?? projectConfig.project,
  };
}
