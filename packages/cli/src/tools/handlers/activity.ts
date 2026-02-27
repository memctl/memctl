import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";

export function registerActivityTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
  onToolCall: (tool: string, action: string) => string | undefined,
) {
  server.tool(
    "activity",
    "Activity logging and agent memos. Actions: log, generate_git_hooks, memo_leave, memo_read",
    {
      action: z
        .enum(["log", "generate_git_hooks", "memo_leave", "memo_read"])
        .describe("Which operation to perform"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("[log] Maximum entries to return"),
      sessionId: z
        .string()
        .optional()
        .describe("[log] Filter by specific session ID"),
      branch: z
        .string()
        .optional()
        .describe("[log] Filter by branch name"),
      hooks: z
        .array(z.enum(["pre-commit", "post-checkout", "prepare-commit-msg"]))
        .optional()
        .describe("[generate_git_hooks] Which hooks to generate"),
      message: z.string().optional().describe("[memo_leave] The memo content"),
      urgency: z
        .enum(["info", "warning", "blocker"])
        .optional()
        .describe("[memo_leave] Urgency level"),
      relatedKeys: z
        .array(z.string())
        .optional()
        .describe("[memo_leave] Memory keys this memo relates to"),
    },
    async (params) => {
      onToolCall("activity", params.action);
      try {
        switch (params.action) {
          case "log": {
            const result = await client.getActivityLogs(
              params.limit ?? 50,
              params.sessionId,
              params.branch,
            );
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "generate_git_hooks": {
            if (!params.hooks?.length)
              return errorResponse(
                "Missing param",
                "hooks required (array of hook names)",
              );
            const scripts: Record<string, string> = {};

            if (params.hooks.includes("pre-commit")) {
              scripts["pre-commit"] = `#!/bin/sh
# memctl pre-commit hook
# Checks modified files against agent context constraints
#
# Install: cp this file to .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

CHANGED_FILES=$(git diff --cached --name-only)

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

echo "[memctl] Checking agent context for modified files..."

# You can customize this to call the memctl CLI or API
# Example with curl:
# curl -s -X POST \\
#   -H "Authorization: Bearer $MEMCTL_TOKEN" \\
#   -H "X-Org-Slug: $MEMCTL_ORG" \\
#   -H "X-Project-Slug: $MEMCTL_PROJECT" \\
#   -H "Content-Type: application/json" \\
#   -d "{\\"filePaths\\": [$(echo "$CHANGED_FILES" | sed 's/.*/"&"/' | tr '\\n' ',' | sed 's/,$//')]]}" \\
#   "$MEMCTL_URL/api/v1/memories/watch"

echo "[memctl] Context check complete."
exit 0
`;
            }

            if (params.hooks.includes("post-checkout")) {
              scripts["post-checkout"] = `#!/bin/sh
# memctl post-checkout hook
# Loads branch context after switching branches
#
# Install: cp this file to .git/hooks/post-checkout && chmod +x .git/hooks/post-checkout

PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_CHECKOUT=$3

if [ "$BRANCH_CHECKOUT" != "1" ]; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "[memctl] Switched to branch: $BRANCH"
echo "[memctl] Run 'branch_context_get' in your agent to load the branch plan."

exit 0
`;
            }

            if (params.hooks.includes("prepare-commit-msg")) {
              scripts["prepare-commit-msg"] = `#!/bin/sh
# memctl prepare-commit-msg hook
# Adds context reminder to commit message template
#
# Install: cp this file to .git/hooks/prepare-commit-msg && chmod +x .git/hooks/prepare-commit-msg

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only add for regular commits (not merge/squash)
if [ -z "$COMMIT_SOURCE" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "" >> "$COMMIT_MSG_FILE"
  echo "# [memctl] Branch: $BRANCH" >> "$COMMIT_MSG_FILE"
  echo "# Run 'session_end' after committing to save session context." >> "$COMMIT_MSG_FILE"
fi

exit 0
`;
            }

            return textResponse(
              JSON.stringify(
                {
                  hooks: Object.keys(scripts),
                  scripts,
                  installation:
                    "Save each script to .git/hooks/<name> and run chmod +x on it.",
                },
                null,
                2,
              ),
            );
          }
          case "memo_leave": {
            if (!params.message)
              return errorResponse("Missing param", "message required");
            const urgency = params.urgency ?? "info";
            const id = Date.now().toString(36);
            const key = `agent/memo/${id}`;
            const priorityMap: Record<string, number> = {
              info: 30,
              warning: 60,
              blocker: 90,
            };
            const ttlMs =
              urgency === "blocker" ? 7 * 86_400_000 : 3 * 86_400_000;

            await client.storeMemory(
              key,
              params.message,
              {
                urgency,
                relatedKeys: params.relatedKeys ?? [],
                createdAt: new Date().toISOString(),
              },
              {
                priority: priorityMap[urgency] ?? 30,
                tags: ["memo", urgency],
                expiresAt: Date.now() + ttlMs,
              },
            );

            return textResponse(
              `Memo left (${urgency}): "${params.message.slice(0, 100)}${params.message.length > 100 ? "..." : ""}"`,
            );
          }
          case "memo_read": {
            const result = await client.searchMemories("agent/memo/", 50);
            const memos = result as {
              memories?: Array<Record<string, unknown>>;
            };
            const items = (memos.memories ?? [])
              .filter((m) => String(m.key).startsWith("agent/memo/"))
              .map((m) => {
                let meta: Record<string, unknown> = {};
                try {
                  meta =
                    typeof m.metadata === "string"
                      ? JSON.parse(m.metadata)
                      : ((m.metadata as Record<string, unknown>) ?? {});
                } catch {
                  /* ignore */
                }
                return {
                  key: m.key,
                  message: m.content,
                  urgency: meta.urgency ?? "info",
                  relatedKeys: meta.relatedKeys ?? [],
                  createdAt: meta.createdAt,
                };
              });

            const byNewest = (a: { createdAt?: unknown }, b: { createdAt?: unknown }) => {
              const ta = typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0;
              const tb = typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0;
              return tb - ta;
            };
            const blockers = items.filter((m) => m.urgency === "blocker").sort(byNewest);
            const warnings = items.filter((m) => m.urgency === "warning").sort(byNewest);
            const infos = items.filter((m) => m.urgency === "info").sort(byNewest);

            return textResponse(
              JSON.stringify(
                {
                  totalMemos: items.length,
                  blockers: blockers.length,
                  warnings: warnings.length,
                  infos: infos.length,
                  memos: [...blockers, ...warnings, ...infos],
                  hint:
                    items.length === 0
                      ? "No memos from previous sessions."
                      : blockers.length > 0
                        ? `${blockers.length} BLOCKER(s) require attention before proceeding.`
                        : "Review memos and proceed.",
                },
                null,
                2,
              ),
            );
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in activity.${params.action}`, error);
      }
    },
  );
}
