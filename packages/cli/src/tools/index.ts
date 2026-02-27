import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "../api-client.js";
import type { SessionTracker } from "../session-tracker.js";
import { recordToolAction } from "../session-tracker.js";
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

export function registerTools(
  server: McpServer,
  client: ApiClient,
  tracker: SessionTracker,
) {
  const rl = createRateLimitState();
  const onToolCall = (tool: string, action: string): string | undefined => {
    recordToolAction(tracker, tool, action);
    if (
      tool === "context" &&
      (action === "bootstrap" || action === "bootstrap_compact")
    ) {
      tracker.bootstrapped = true;
      return undefined;
    }
    if (!tracker.bootstrapped && !tracker.bootstrapHintShown) {
      tracker.bootstrapHintShown = true;
      return "[Hint] Run context action=bootstrap first to load project context and run maintenance.";
    }
    return undefined;
  };

  registerMemoryTool(server, client, rl, onToolCall);
  registerMemoryAdvancedTool(server, client, rl, onToolCall);
  registerMemoryLifecycleTool(server, client, rl, onToolCall);
  registerContextTool(server, client, rl, onToolCall);
  registerContextConfigTool(server, client, rl, onToolCall);
  registerBranchTool(server, client, rl, onToolCall);
  registerSessionTool(server, client, rl, tracker, onToolCall);
  registerImportExportTool(server, client, rl, onToolCall);
  registerRepoTool(server, client, rl, onToolCall);
  registerOrgTool(server, client, rl, onToolCall);
  registerActivityTool(server, client, rl, onToolCall);
}
