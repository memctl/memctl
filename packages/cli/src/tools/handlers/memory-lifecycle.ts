import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";

const execFileAsync = promisify(execFile);

export function registerMemoryLifecycleTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
) {
  server.tool(
    "memory_lifecycle",
    "Memory lifecycle management. Actions: cleanup, suggest_cleanup, lifecycle_run, lifecycle_schedule, validate_references, prune_stale, feedback, analytics, lock, unlock, health. Policies for lifecycle_run: archive_merged_branches, cleanup_expired, cleanup_session_logs, auto_promote, auto_demote, auto_prune, auto_archive_unhealthy, cleanup_old_versions, cleanup_activity_logs, cleanup_expired_locks, purge_archived",
    {
      action: z
        .enum([
          "cleanup",
          "suggest_cleanup",
          "lifecycle_run",
          "lifecycle_schedule",
          "validate_references",
          "prune_stale",
          "feedback",
          "analytics",
          "lock",
          "unlock",
          "health",
          "policy_get",
          "policy_set",
        ])
        .describe("Which operation to perform"),
      key: z.string().optional().describe("[feedback,lock,unlock] Memory key"),
      helpful: z
        .boolean()
        .optional()
        .describe("[feedback] true=helpful, false=unhelpful"),
      staleDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("[suggest_cleanup] Days threshold"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("[suggest_cleanup,health] Max results"),
      policies: z
        .array(
          z.enum([
            "archive_merged_branches",
            "cleanup_expired",
            "cleanup_session_logs",
            "auto_promote",
            "auto_demote",
            "auto_prune",
            "auto_archive_unhealthy",
            "cleanup_old_versions",
            "cleanup_activity_logs",
            "cleanup_expired_locks",
            "purge_archived",
          ]),
        )
        .optional()
        .describe("[lifecycle_run] Policies to run"),
      healthThreshold: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe(
          "[lifecycle_run] Health score threshold for auto_archive_unhealthy (default: 15)",
        ),
      maxVersionsPerMemory: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe(
          "[lifecycle_run] Max versions to keep per memory (default: 50)",
        ),
      activityLogMaxAgeDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("[lifecycle_run] Max activity log age in days (default: 90)"),
      archivePurgeDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe(
          "[lifecycle_run] Days before archived memories are purged (default: 90)",
        ),
      mergedBranches: z
        .array(z.string())
        .optional()
        .describe("[lifecycle_run] Merged branch names"),
      sessionLogMaxAgeDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe("[lifecycle_run,lifecycle_schedule] Max session log age"),
      accessThreshold: z
        .number()
        .int()
        .optional()
        .describe("[lifecycle_schedule] Promote threshold"),
      feedbackThreshold: z
        .number()
        .int()
        .optional()
        .describe("[lifecycle_schedule] Demote threshold"),
      archiveStale: z
        .boolean()
        .optional()
        .describe("[prune_stale] Archive stale references"),
      policyConfig: z
        .object({
          autoCleanupOnBootstrap: z.boolean().optional(),
          maxStaleDays: z.number().int().min(1).max(365).optional(),
          autoArchiveHealthBelow: z.number().min(0).max(100).optional(),
          maxMemories: z.number().int().min(1).optional(),
        })
        .optional()
        .describe("[policy_set] Cleanup policy configuration"),
      lockedBy: z.string().optional().describe("[lock,unlock] Lock holder ID"),
      ttlSeconds: z
        .number()
        .int()
        .min(5)
        .max(600)
        .optional()
        .describe("[lock] Lock TTL"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "cleanup": {
            const result = await client.cleanupExpired();
            return textResponse(
              `Cleanup complete: ${result.cleaned} expired memories removed.`,
            );
          }
          case "suggest_cleanup": {
            const result = await client.suggestCleanup(
              params.staleDays ?? 30,
              params.limit ?? 20,
            );
            const totalSuggestions =
              result.stale.length + result.expired.length;
            if (totalSuggestions === 0)
              return textResponse(
                "No cleanup suggestions. Memory store looks healthy.",
              );
            return textResponse(
              JSON.stringify(
                {
                  summary: `Found ${result.stale.length} stale and ${result.expired.length} expired memories.`,
                  ...result,
                  actions:
                    "Use memory archive to archive stale memories, or cleanup to remove expired ones.",
                },
                null,
                2,
              ),
            );
          }
          case "lifecycle_run": {
            if (!params.policies?.length)
              return errorResponse("Missing param", "policies required");
            const result = await client.runLifecycle(params.policies, {
              mergedBranches: params.mergedBranches,
              sessionLogMaxAgeDays: params.sessionLogMaxAgeDays,
              healthThreshold: params.healthThreshold,
              maxVersionsPerMemory: params.maxVersionsPerMemory,
              activityLogMaxAgeDays: params.activityLogMaxAgeDays,
              archivePurgeDays: params.archivePurgeDays,
            });
            const summary = Object.entries(result.results)
              .map(
                ([policy, r]) =>
                  `${policy}: ${r.affected} affected${r.details ? ` (${r.details})` : ""}`,
              )
              .join("\n");
            return textResponse(`Lifecycle policies executed:\n${summary}`);
          }
          case "lifecycle_schedule": {
            const result = await client.runScheduledLifecycle({
              sessionLogMaxAgeDays: params.sessionLogMaxAgeDays ?? 30,
              accessThreshold: params.accessThreshold ?? 10,
              feedbackThreshold: params.feedbackThreshold ?? 3,
            });
            const totalAffected = Object.values(result.results).reduce(
              (sum, r) => sum + r.affected,
              0,
            );
            return textResponse(
              JSON.stringify(
                {
                  ranAt: result.ranAt,
                  totalAffected,
                  policies: result.results,
                  message:
                    totalAffected > 0
                      ? `Lifecycle complete: ${totalAffected} entries affected.`
                      : "Lifecycle complete: no entries needed maintenance.",
                },
                null,
                2,
              ),
            );
          }
          case "validate_references": {
            const gitResult = await execFileAsync(
              "git",
              ["ls-files", "--cached", "--others", "--exclude-standard"],
              { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
            );
            const repoFiles = gitResult.stdout
              .trim()
              .split("\n")
              .filter(Boolean);
            const validation = await client.validateReferences(repoFiles);
            if (validation.issuesFound === 0)
              return textResponse(
                `All references valid. Checked ${validation.totalMemoriesChecked} memories against ${repoFiles.length} repo files.`,
              );
            return textResponse(
              JSON.stringify(
                {
                  summary: `Found ${validation.issuesFound} memories with stale file references.`,
                  ...validation,
                },
                null,
                2,
              ),
            );
          }
          case "prune_stale": {
            const gitResult = await execFileAsync(
              "git",
              ["ls-files", "--cached", "--others", "--exclude-standard"],
              { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
            );
            const repoFiles = gitResult.stdout
              .trim()
              .split("\n")
              .filter(Boolean);
            const validation = await client.validateReferences(repoFiles);
            if (validation.issuesFound === 0)
              return textResponse("No stale references found.");
            if (params.archiveStale) {
              const staleKeys = validation.issues.map((i) => i.key);
              const batchResult = await client.batchMutate(
                staleKeys,
                "archive",
              );
              return textResponse(
                `Archived ${batchResult.affected} memories with stale file references.`,
              );
            }
            return textResponse(
              JSON.stringify(
                {
                  summary: `${validation.issuesFound} memories reference deleted files.`,
                  issues: validation.issues,
                  hint: "Call again with archiveStale=true to archive.",
                },
                null,
                2,
              ),
            );
          }
          case "feedback": {
            if (!params.key)
              return errorResponse("Missing param", "key required");
            if (params.helpful === undefined)
              return errorResponse("Missing param", "helpful required");
            const result = await client.feedbackMemory(
              params.key,
              params.helpful,
            );
            return textResponse(
              `Feedback recorded for "${params.key}": ${result.feedback} (${result.helpfulCount} helpful, ${result.unhelpfulCount} unhelpful)`,
            );
          }
          case "analytics": {
            const analytics = await client.getAnalytics();
            return textResponse(JSON.stringify(analytics, null, 2));
          }
          case "lock": {
            if (!params.key)
              return errorResponse("Missing param", "key required");
            const result = await client.lockMemory(
              params.key,
              params.lockedBy,
              params.ttlSeconds ?? 60,
            );
            if (!result.acquired)
              return textResponse(
                JSON.stringify(
                  {
                    acquired: false,
                    key: params.key,
                    message: "Lock held by another agent.",
                    currentLock: result.lock,
                  },
                  null,
                  2,
                ),
              );
            return textResponse(
              JSON.stringify(
                {
                  acquired: true,
                  key: params.key,
                  expiresAt: result.lock.expiresAt,
                  message: `Lock acquired. Expires in ${params.ttlSeconds ?? 60}s.`,
                },
                null,
                2,
              ),
            );
          }
          case "unlock": {
            if (!params.key)
              return errorResponse("Missing param", "key required");
            const result = await client.unlockMemory(
              params.key,
              params.lockedBy,
            );
            return textResponse(
              `Lock released for key: ${params.key} (released: ${result.released})`,
            );
          }
          case "health": {
            const result = await client.getHealthScores(params.limit ?? 50);
            const unhealthy = result.memories.filter((m) => m.healthScore < 40);
            return textResponse(
              JSON.stringify(
                {
                  total: result.memories.length,
                  unhealthyCount: unhealthy.length,
                  memories: result.memories,
                  hint:
                    unhealthy.length > 0
                      ? `${unhealthy.length} memories have health score below 40.`
                      : "All memories are in good health.",
                },
                null,
                2,
              ),
            );
          }
          case "policy_get": {
            const POLICY_KEY = "agent/config/cleanup_policy";
            const defaults = {
              autoCleanupOnBootstrap: true,
              maxStaleDays: 30,
              autoArchiveHealthBelow: 15,
              maxMemories: 500,
            };
            try {
              const mem = (await client.getMemory(POLICY_KEY)) as {
                memory?: { content?: string };
              };
              if (mem?.memory?.content) {
                const config = JSON.parse(mem.memory.content);
                return textResponse(
                  JSON.stringify(
                    { ...defaults, ...config, source: "project" },
                    null,
                    2,
                  ),
                );
              }
            } catch {
              /* not found */
            }
            return textResponse(
              JSON.stringify({ ...defaults, source: "defaults" }, null, 2),
            );
          }
          case "policy_set": {
            if (!params.policyConfig)
              return errorResponse("Missing param", "policyConfig required");
            const POLICY_KEY = "agent/config/cleanup_policy";
            await client.storeMemory(
              POLICY_KEY,
              JSON.stringify(params.policyConfig),
              { type: "system_config" },
              { priority: 100, tags: ["system:config"] },
            );
            return textResponse(
              `Cleanup policy saved. Config: ${JSON.stringify(params.policyConfig)}`,
            );
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(
          `Error in memory_lifecycle.${params.action}`,
          error,
        );
      }
    },
  );
}
