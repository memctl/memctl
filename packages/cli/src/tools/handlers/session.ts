import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";
import { getBranchInfo } from "../../agent-context.js";

function generateSessionId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `sess-${now}-${rand}`;
}

function buildFallbackSummary(params: {
  keysRead?: string[];
  keysWritten?: string[];
  toolsUsed?: string[];
}): string {
  const parts: string[] = [];
  if (params.keysWritten?.length) {
    parts.push(`${params.keysWritten.length} key(s) written`);
  }
  if (params.keysRead?.length) {
    parts.push(`${params.keysRead.length} key(s) read`);
  }
  if (params.toolsUsed?.length) {
    parts.push(`tools: ${params.toolsUsed.join(", ")}`);
  }
  if (parts.length === 0) {
    return "Session ended without explicit summary.";
  }
  return `Session ended, ${parts.join(", ")}.`;
}

export function registerSessionTool(
  server: McpServer,
  client: ApiClient,
  rl: RateLimitState,
) {
  let activeSessionId: string | null = null;

  const autoCloseSession = () => {
    if (!activeSessionId) return;
    const sid = activeSessionId;
    activeSessionId = null;
    void client
      .upsertSessionLog({
        sessionId: sid,
        summary: "Auto-closed: MCP server process exited.",
        endedAt: Date.now(),
      })
      .catch(() => {});
  };

  // Guard against duplicate listeners when registerSessionTool is called
  // multiple times (e.g. in tests).
  const key = "__memctl_session_exit_registered__";
  const proc = process as unknown as Record<string, unknown>;
  if (!proc[key]) {
    proc[key] = true;
    process.once("beforeExit", autoCloseSession);
    process.once("SIGINT", autoCloseSession);
    process.once("SIGTERM", autoCloseSession);
  }

  server.tool(
    "session",
    "Session management. Actions: start, end, history, claims_check, claim, rate_status",
    {
      action: z
        .enum([
          "start",
          "end",
          "history",
          "claims_check",
          "claim",
          "rate_status",
        ])
        .describe("Which operation to perform"),
      sessionId: z.string().optional().describe("[start,end,claim] Session ID"),
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
      autoExtractGit: z
        .boolean()
        .optional()
        .describe("[start] Deprecated, ignored"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "start": {
            const sessionId = params.sessionId ?? generateSessionId();
            const branchInfo = await getBranchInfo();
            const recentSessions = await client
              .getSessionLogs(5)
              .catch(() => ({ sessionLogs: [] }));
            await client.upsertSessionLog({
              sessionId,
              branch: branchInfo?.branch,
            });
            activeSessionId = sessionId;

            // Auto-close stale sessions (open > 2 hours)
            const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
            const now = Date.now();
            let staleSessionsClosed = 0;
            for (const log of recentSessions.sessionLogs) {
              if (log.endedAt) continue;
              const startedAt =
                typeof log.startedAt === "number"
                  ? log.startedAt
                  : typeof log.startedAt === "string"
                    ? new Date(log.startedAt).getTime()
                    : 0;
              if (!startedAt || now - startedAt < TWO_HOURS_MS) continue;
              try {
                await client.upsertSessionLog({
                  sessionId: log.sessionId,
                  summary:
                    log.summary ||
                    "Auto-closed: session exceeded 2-hour inactivity limit.",
                  endedAt: now,
                });
                staleSessionsClosed++;
              } catch {
                // Best effort
              }
            }

            const lastSession = recentSessions.sessionLogs[0];
            const handoff = lastSession
              ? {
                  previousSessionId: lastSession.sessionId,
                  summary: lastSession.summary,
                  branch: lastSession.branch,
                  keysWritten: lastSession.keysWritten
                    ? JSON.parse(lastSession.keysWritten)
                    : [],
                  endedAt: lastSession.endedAt,
                }
              : null;

            return textResponse(
              JSON.stringify(
                {
                  sessionId,
                  generatedSessionId: !params.sessionId,
                  currentBranch: branchInfo,
                  handoff,
                  recentSessionCount: recentSessions.sessionLogs.length,
                  staleSessionsClosed,
                },
                null,
                2,
              ),
            );
          }
          case "end": {
            const sessionId =
              params.sessionId ?? activeSessionId ?? generateSessionId();
            const summary =
              params.summary?.trim() ||
              buildFallbackSummary({
                keysRead: params.keysRead,
                keysWritten: params.keysWritten,
                toolsUsed: params.toolsUsed,
              });
            await client.upsertSessionLog({
              sessionId,
              summary,
              keysRead: params.keysRead,
              keysWritten: params.keysWritten,
              toolsUsed: params.toolsUsed,
              endedAt: Date.now(),
            });
            activeSessionId = null;
            return textResponse(
              `Session ${sessionId} ended. Handoff summary saved.`,
            );
          }
          case "history": {
            const result = await client.getSessionLogs(params.limit ?? 10);
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
              const sessionId = claim.key.replace("agent/claims/", "");
              if (params.excludeSession && sessionId === params.excludeSession)
                continue;
              let claimedKeys: string[] = [];
              try {
                claimedKeys = JSON.parse(claim.content ?? "[]");
              } catch {
                continue;
              }
              const conflicts = claimedKeys.filter((k) => keysToCheck.has(k));
              activeClaims.push({
                sessionId,
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
            const sessionId =
              params.sessionId ?? activeSessionId ?? generateSessionId();
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
            activeSessionId = sessionId;
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

