import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  getConfigPath,
  loadConfig,
  loadConfigForCwd,
  saveConfig,
  type MemctlConfig,
} from "./config.js";
import { bold, cyan, green, red, yellow } from "./ui.js";

type ConfigFlags = Record<string, string | boolean>;

function toStringFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function createEmptyConfig(): MemctlConfig {
  return {
    profiles: {},
  };
}

async function promptRequired(
  rl: ReturnType<typeof createInterface>,
  label: string,
  fallback = "",
): Promise<string> {
  while (true) {
    const answer = await rl.question(
      `  ${label}${fallback ? ` [${fallback}]` : ""}: `,
    );
    const value = answer.trim() || fallback;
    if (value) return value;
    console.error(`  ${red(`${label} is required.`)}`);
  }
}

async function promptOptional(
  rl: ReturnType<typeof createInterface>,
  label: string,
  fallback = "",
): Promise<string> {
  const answer = await rl.question(
    `  ${label}${fallback ? ` [${fallback}]` : ""}: `,
  );
  return answer.trim() || fallback;
}

async function printResolvedConfig(): Promise<void> {
  const resolved = await loadConfigForCwd();
  console.log(`Config:   ${getConfigPath()}`);
  if (!resolved) {
    console.log(
      yellow(
        'Not configured. Run "memctl auth" and "memctl init" to get started.',
      ),
    );
    return;
  }

  const masked =
    resolved.token.length > 8 ? resolved.token.slice(0, 8) + "..." : "***";
  console.log(`API URL:  ${resolved.baseUrl}`);
  console.log(`Org:      ${resolved.org}`);
  console.log(`Project:  ${resolved.project}`);
  console.log(`Token:    ${masked}`);
}

export async function runConfig(flags: ConfigFlags): Promise<void> {
  if (flags.show) {
    await printResolvedConfig();
    return;
  }

  const useGlobal = Boolean(flags.global);
  const fileConfig = (await loadConfig()) ?? createEmptyConfig();
  const profileName = "default";
  const currentProfile = fileConfig.profiles[profileName];

  const flagApiUrl = toStringFlag(flags["api-url"]);
  const flagToken = toStringFlag(flags.token);
  const rawFlagOrg = toStringFlag(flags.org);
  const rawFlagProject = toStringFlag(flags.project);

  const hasDirectFlags = Boolean(
    flagApiUrl || flagToken,
  );

  if (rawFlagOrg || rawFlagProject) {
    console.error(
      red("Org and project are no longer stored in ~/.memctl/config.json."),
    );
    console.error(
      yellow("Set MEMCTL_ORG and MEMCTL_PROJECT in your MCP config env."),
    );
    process.exit(1);
  }

  if (hasDirectFlags) {
    fileConfig.profiles[profileName] = {
      token: flagToken || currentProfile?.token || "",
      apiUrl: flagApiUrl || currentProfile?.apiUrl || "https://memctl.com/api/v1",
    };

    fileConfig.projects = {};

    if (!fileConfig.profiles[profileName].token) {
      console.error(
        red("Token is missing. Provide --token or run `memctl auth` first."),
      );
      process.exit(1);
    }

    await saveConfig(fileConfig);
    const scopeLabel = useGlobal ? "global profile" : "credentials";
    console.log(green(`Updated ${scopeLabel} at ${getConfigPath()}`));
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log(`\n  ${bold(cyan("memctl config"))}\n`);
    if (useGlobal) {
      console.log("  Update global API URL and token.\n");
    } else {
      console.log("  Update API URL and token.\n");
      console.log("  Org/project must be set in MCP config env.\n");
    }

    const apiUrl = await promptRequired(
      rl,
      "API URL",
      currentProfile?.apiUrl || "https://memctl.com/api/v1",
    );

    const token = await promptOptional(
      rl,
      "API token",
      currentProfile?.token || "",
    );
    if (!token) {
      console.error(`  ${red("API token is required.")}`);
      process.exit(1);
    }

    fileConfig.profiles[profileName] = { token, apiUrl };
    fileConfig.projects = {};

    await saveConfig(fileConfig);

    const scopeLabel = useGlobal ? "global profile" : "credentials";
    console.log(`\n  ${green(`Saved ${scopeLabel} to ${getConfigPath()}`)}\n`);
  } finally {
    rl.close();
  }
}
