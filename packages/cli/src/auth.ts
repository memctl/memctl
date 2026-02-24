import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig, saveConfig, type MemctlConfig } from "./config.js";

export async function runAuth(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\n  memctl auth\n");
    console.log("  Authenticate with memctl to store your API token locally.");
    console.log(
      "  After this, MCP configs only need org and project — no token.\n",
    );

    // 1. API URL
    const defaultUrl = "https://memctl.com/api/v1";
    const apiUrlInput = await rl.question(`  API URL [${defaultUrl}]: `);
    const apiUrl = apiUrlInput.trim() || defaultUrl;

    // 2. API token
    console.log(
      "\n  Get your API token from: https://memctl.com → Settings → API Tokens\n",
    );
    const token = await rl.question("  API token: ");
    if (!token.trim()) {
      console.error("\n  Token is required. Aborting.\n");
      process.exit(1);
    }

    // 3. Test connectivity
    console.log("  Verifying token...");
    try {
      const res = await fetch(`${apiUrl}/health`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log("  Token valid.\n");
      } else {
        console.warn(
          `  Warning: API returned ${res.status}. Token may be invalid.\n`,
        );
      }
    } catch {
      console.warn("  Warning: Could not reach API. Saving token anyway.\n");
    }

    // 4. Save to config file
    const config: MemctlConfig = (await loadConfig()) ?? {
      profiles: {},
      projects: {},
    };
    config.profiles.default = { token: token.trim(), apiUrl };
    await saveConfig(config);

    console.log("  Authenticated! Token saved to ~/.memctl/config.json");
    console.log("");
    console.log(
      "  You can now use simplified MCP configs with just org and project:",
    );
    console.log("");
    console.log("  {");
    console.log('    "mcpServers": {');
    console.log('      "memctl": {');
    console.log('        "command": "npx",');
    console.log('        "args": ["-y", "memctl@latest"],');
    console.log('        "env": {');
    console.log('          "MEMCTL_ORG": "your-org",');
    console.log('          "MEMCTL_PROJECT": "your-project"');
    console.log("        }");
    console.log("      }");
    console.log("    }");
    console.log("  }");
    console.log("");
  } finally {
    rl.close();
  }
}
