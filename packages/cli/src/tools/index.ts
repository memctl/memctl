import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import { createRateLimitState } from "./rate-limit.js";
import { registerMemoryTool } from "./handlers/memory.js";
import { registerMemoryAdvancedTool } from "./handlers/memory-advanced.js";
import { registerMemoryLifecycleTool } from "./handlers/memory-lifecycle.js";
import { registerContextTool } from "./handlers/context.js";
import { registerContextConfigTool } from "./handlers/context-config.js";
import { registerBranchTool } from "./handlers/branch.js";
import { registerSessionTool } from "./handlers/session.js";
import { registerImportExportTool } from "./handlers/import-export.js";
import { registerRepoTool } from "./handlers/repo.js";
import { registerOrgTool } from "./handlers/org.js";
import { registerActivityTool } from "./handlers/activity.js";

export function registerTools(server: McpServer, client: ApiClient) {
  const rl = createRateLimitState();

  registerMemoryTool(server, client, rl);
  registerMemoryAdvancedTool(server, client, rl);
  registerMemoryLifecycleTool(server, client, rl);
  registerContextTool(server, client, rl);
  registerContextConfigTool(server, client, rl);
  registerBranchTool(server, client, rl);
  registerSessionTool(server, client, rl);
  registerImportExportTool(server, client, rl);
  registerRepoTool(server, client, rl);
  registerOrgTool(server, client, rl);
  registerActivityTool(server, client, rl);
}
