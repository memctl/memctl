import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";
import type { SessionTracker } from "../../session-tracker.js";

export function registerSessionTool(
  server: McpServer,
  client: ApiClient,
  rl: RateLimitState,
  tracker: SessionTracker,
  onToolCall: (tool: string, action: string) => void,
) {
  server.tool(
    "session",
    "Session management. Actions: end, history, claims_check, claim, rate_status",
    {
      action: z
        .enum([
          "end",
          "history",
          "claims_check",
          "claim",
          "rate_status",
        ])
        .describe("Which operation to perform"),
      sessionId: z.string().optional().describe("[end,claim] Session ID"),
      summary: z.string().optional().describe("[end] Session summary"),
      keysRead: z.array(z.string()).optional().describe("[end] Keys read"),
      keysWritten: z
        .array(z.string())
        .optional()
        .describe("[end] Keys written"),
      toolsUsed: z.array(z.string()).optional().describe("[end] Tools used"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("[history] Max results"),
      branch: z
        .string()
        .optional()
        .describe("[history] Filter by branch name"),
      keys: z
        .array(z.string())
        .optional()
        .describe("[claims_check,claim] Memory keys"),
      excludeSession: z
        .string()
        .optional()
        .describe("[claims_check] Exclude session"),
      ttlMinutes: z
        .number()
        .optional()
        .describe("[claim] Claim TTL in minutes"),
    },
    async (params) => {
      onToolCall("session", params.action);
      try {
        switch (params.action) {
          case "end": {
            const sessionId = params.sessionId ?? tracker.sessionId;

            // Enrich agent-provided summary with tracker data
            const trackerWritten = [...tracker.writtenKeys];
            const trackerRead = [...tracker.readKeys];
            const trackerTools = [...tracker.toolActions];

            const mergedKeysWritten = [
              ...new Set([
                ...(params.keysWritten ?? []),
                ...trackerWritten,
              ]),
            ];
            const mergedKeysRead = [
              ...new Set([
                ...(params.keysRead ?? []),
                ...trackerRead,
              ]),
            ];
            const mergedToolsUsed = [
              ...new Set([
                ...(params.toolsUsed ?? []),
                ...trackerTools,
              ]),
            ];

            const summary =
              params.summary?.trim() || "Session ended without explicit summary.";
            await client.upsertSessionLog({
              sessionId,
              summary,
              keysRead: mergedKeysRead,
              keysWritten: mergedKeysWritten,
              toolsUsed: mergedToolsUsed,
              endedAt: Date.now(),
            });
            tracker.endedExplicitly = true;
            return textResponse(
              `Session ${sessionId} ended. Handoff summary saved.`,
            );
          }
          case "history": {
            const result = await client.getSessionLogs(
              params.limit ?? 10,
              params.branch,
            );
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "claims_check": {
            if (!params.keys?.length)
              return errorResponse("Missing param", "keys required");
            const result = (await client.searchMemories("agent/claims/", 100, {
              tags: "session-claim",
            })) as {
              memories?: Array<{
                key: string;
                content?: string;
                expiresAt?: unknown;
                metadata?: unknown;
              }>;
            };
            const claims = result.memories ?? [];
            const now = Date.now();
            const keysToCheck = new Set(params.keys);

            const activeClaims: Array<{
              sessionId: string;
              claimedKeys: string[];
              expiresAt: string;
              conflicts: string[];
            }> = [];
            for (const claim of claims) {
              const expiresAt = claim.expiresAt
                ? new Date(claim.expiresAt as string).getTime()
                : 0;
              if (expiresAt && expiresAt < now) continue;
              const claimSessionId = claim.key.replace("agent/claims/", "");
              if (params.excludeSession && claimSessionId === params.excludeSession)
                continue;
              let claimedKeys: string[] = [];
              try {
                claimedKeys = JSON.parse(claim.content ?? "[]");
              } catch {
                continue;
              }
              const conflicts = claimedKeys.filter((k) => keysToCheck.has(k));
              activeClaims.push({
                sessionId: claimSessionId,
                claimedKeys,
                expiresAt: expiresAt
                  ? new Date(expiresAt).toISOString()
                  : "unknown",
                conflicts,
              });
            }

            const allConflicts = [
              ...new Set(activeClaims.flatMap((c) => c.conflicts)),
            ];
            return textResponse(
              JSON.stringify(
                {
                  checkedKeys: params.keys,
                  activeSessions: activeClaims.length,
                  conflicts: allConflicts,
                  details: activeClaims.filter((c) => c.conflicts.length > 0),
                  hint:
                    allConflicts.length > 0
                      ? `${allConflicts.length} key(s) claimed by other sessions.`
                      : "No conflicts found.",
                },
                null,
                2,
              ),
            );
          }
          case "claim": {
            if (!params.keys?.length)
              return errorResponse(
                "Missing params",
                "keys required",
              );
            const sessionId = params.sessionId ?? tracker.sessionId;
            const rateCheck = rl.checkRateLimit();
            if (!rateCheck.allowed)
              return errorResponse("Rate limit exceeded", rateCheck.warning!);
            rl.incrementWriteCount();

            const claimKey = `agent/claims/${sessionId}`;
            const ttlMinutes = params.ttlMinutes ?? 30;
            const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
            await client.storeMemory(
              claimKey,
              JSON.stringify(params.keys),
              { sessionId, claimedAt: Date.now() },
              { tags: ["session-claim"], expiresAt, priority: 0 },
            );
            const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
            return textResponse(
              JSON.stringify(
                {
                  sessionId,
                  generatedSessionId: !params.sessionId,
                  claimKey,
                  keys: params.keys,
                  expiresAt: new Date(expiresAt).toISOString(),
                  ttlMinutes,
                  message: `Claimed ${params.keys.length} key(s).${rateWarn}`,
                },
                null,
                2,
              ),
            );
          }
          case "rate_status": {
            const pct = Math.round((rl.writeCallCount / rl.RATE_LIMIT) * 100);
            return textResponse(
              JSON.stringify(
                {
                  callsMade: rl.writeCallCount,
                  limit: rl.RATE_LIMIT,
                  remaining: Math.max(0, rl.RATE_LIMIT - rl.writeCallCount),
                  percentageUsed: pct,
                  status: pct >= 100 ? "blocked" : pct >= 80 ? "warning" : "ok",
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
        return errorResponse(`Error in session.${params.action}`, error);
      }
    },
  );
}
