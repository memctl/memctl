import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import {
  textResponse,
  errorResponse,
  hasMemoryFullError,
} from "../response.js";
import {
  buildBranchPlanKey,
  extractAgentContextEntries,
  getBranchInfo,
  listAllMemories,
} from "../../agent-context.js";

export function registerBranchTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
  onToolCall: (tool: string, action: string) => void,
) {
  server.tool(
    "branch",
    "Branch context management. Actions: get, set, delete",
    {
      action: z
        .enum(["get", "set", "delete"])
        .describe("Which operation to perform"),
      branch: z
        .string()
        .optional()
        .describe("Branch name (defaults to current git branch)"),
      includeRelatedContext: z
        .boolean()
        .optional()
        .describe("[get] Include related entries"),
      content: z.string().optional().describe("[set] Implementation plan"),
      metadata: z.record(z.unknown()).optional().describe("[set] Metadata"),
      status: z
        .enum(["planning", "in_progress", "review", "merged"])
        .optional()
        .describe("[set] Plan status"),
      checklist: z
        .array(z.object({ item: z.string(), done: z.boolean() }))
        .optional()
        .describe("[set] Checklist items"),
    },
    async (params) => {
      onToolCall("branch", params.action);
      try {
        switch (params.action) {
          case "get": {
            const currentBranchInfo = await getBranchInfo();
            const selectedBranch =
              (params.branch as string) ?? currentBranchInfo?.branch;
            if (!selectedBranch)
              return errorResponse(
                "Error",
                "No git branch detected. Pass branch explicitly.",
              );

            const key = buildBranchPlanKey(selectedBranch);
            const branchPlan = await client.getMemory(key).catch(() => null);

            let relatedContext: Array<{
              type: string;
              id: string;
              title: string;
              relevanceScore: number;
            }> = [];
            if (params.includeRelatedContext) {
              const allMemories = await listAllMemories(client);
              const entries = extractAgentContextEntries(allMemories);
              const branchTerms = selectedBranch
                .split(/[-_/]/)
                .filter((t) => t.length > 2)
                .map((t) => t.toLowerCase());
              relatedContext = entries
                .filter((e) => e.type !== "branch_plan")
                .map((entry) => {
                  const text = `${entry.title} ${entry.content}`.toLowerCase();
                  let score = 0;
                  for (const term of branchTerms) {
                    if (text.includes(term)) score += 10;
                  }
                  if (text.includes(selectedBranch.toLowerCase())) score += 50;
                  return { entry, score };
                })
                .filter((s) => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((s) => ({
                  type: s.entry.type,
                  id: s.entry.id,
                  title: s.entry.title,
                  relevanceScore: s.score,
                }));
            }

            let planStatus = null;
            if (branchPlan && typeof branchPlan === "object") {
              const plan = branchPlan as { memory?: { metadata?: string } };
              if (plan.memory?.metadata) {
                try {
                  const meta =
                    typeof plan.memory.metadata === "string"
                      ? JSON.parse(plan.memory.metadata)
                      : plan.memory.metadata;
                  planStatus = {
                    status: meta.planStatus ?? "active",
                    checklist: meta.checklist ?? null,
                    completedItems: meta.completedItems ?? null,
                    totalItems: meta.totalItems ?? null,
                  };
                } catch {
                  /* ignore */
                }
              }
            }

            return textResponse(
              JSON.stringify(
                {
                  currentBranch: currentBranchInfo,
                  selectedBranch,
                  branchPlanKey: key,
                  branchPlan,
                  planStatus,
                  relatedContext: params.includeRelatedContext
                    ? relatedContext
                    : undefined,
                },
                null,
                2,
              ),
            );
          }
          case "set": {
            const currentBranchInfo = await getBranchInfo();
            const selectedBranch =
              (params.branch as string) ?? currentBranchInfo?.branch;
            if (!selectedBranch)
              return errorResponse(
                "Error",
                "No git branch detected. Pass branch explicitly.",
              );
            if (!params.content)
              return errorResponse("Missing param", "content required");

            const key = buildBranchPlanKey(selectedBranch);
            const checklist = params.checklist as
              | Array<{ item: string; done: boolean }>
              | undefined;
            const completedItems = checklist
              ? checklist.filter((c) => c.done).length
              : undefined;
            const totalItems = checklist ? checklist.length : undefined;

            await client.storeMemory(key, params.content, {
              ...(params.metadata as Record<string, unknown> | undefined),
              scope: "agent_functionality",
              type: "branch_plan",
              branch: selectedBranch,
              title: `Branch plan: ${selectedBranch}`,
              planStatus: (params.status as string) ?? "in_progress",
              checklist,
              completedItems,
              totalItems,
              updatedByTool: "branch.set",
              updatedAt: new Date().toISOString(),
            });

            const statusMsg = params.status ? ` [${params.status}]` : "";
            const checklistMsg = checklist
              ? ` (${completedItems}/${totalItems} items done)`
              : "";
            return textResponse(
              `Branch context saved: ${key}${statusMsg}${checklistMsg}`,
            );
          }
          case "delete": {
            const currentBranchInfo = await getBranchInfo();
            const selectedBranch =
              (params.branch as string) ?? currentBranchInfo?.branch;
            if (!selectedBranch)
              return errorResponse(
                "Error",
                "No git branch detected. Pass branch explicitly.",
              );
            const key = buildBranchPlanKey(selectedBranch);
            await client.deleteMemory(key);
            return textResponse(`Branch context deleted: ${key}`);
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        if (hasMemoryFullError(error))
          return errorResponse(
            "Error",
            `${error instanceof Error ? error.message : String(error)} Delete old memories first.`,
          );
        return errorResponse(`Error in branch.${params.action}`, error);
      }
    },
  );
}
