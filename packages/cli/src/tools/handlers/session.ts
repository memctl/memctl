import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";
import { getBranchInfo } from "../../agent-context.js";

const execFileAsync = promisify(execFile);

export function registerSessionTool(
  server: McpServer,
  client: ApiClient,
  rl: RateLimitState,
) {
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
        .describe(
          "[start] Auto-extract git changes since last session (default: true)",
        ),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "start": {
            if (!params.sessionId)
              return errorResponse("Missing param", "sessionId required");
            const branchInfo = await getBranchInfo();
            const recentSessions = await client
              .getSessionLogs(5)
              .catch(() => ({ sessionLogs: [] }));
            await client.upsertSessionLog({
              sessionId: params.sessionId,
              branch: branchInfo?.branch,
            });

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

            // Auto-extract git changes since last session
            let gitContext: {
              commits?: string;
              diffStat?: string;
              todos?: string[];
            } | null = null;
            if (params.autoExtractGit !== false) {
              gitContext = await extractGitContext(
                client,
                lastSession?.endedAt,
              );
            }

            return textResponse(
              JSON.stringify(
                {
                  sessionId: params.sessionId,
                  currentBranch: branchInfo,
                  handoff,
                  recentSessionCount: recentSessions.sessionLogs.length,
                  ...(gitContext ? { gitContext } : {}),
                },
                null,
                2,
              ),
            );
          }
          case "end": {
            if (!params.sessionId || !params.summary)
              return errorResponse(
                "Missing params",
                "sessionId and summary required",
              );
            await client.upsertSessionLog({
              sessionId: params.sessionId,
              summary: params.summary,
              keysRead: params.keysRead,
              keysWritten: params.keysWritten,
              toolsUsed: params.toolsUsed,
              endedAt: Date.now(),
            });
            return textResponse(
              `Session ${params.sessionId} ended. Handoff summary saved.`,
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
            if (!params.sessionId || !params.keys?.length)
              return errorResponse(
                "Missing params",
                "sessionId and keys required",
              );
            const rateCheck = rl.checkRateLimit();
            if (!rateCheck.allowed)
              return errorResponse("Rate limit exceeded", rateCheck.warning!);
            rl.incrementWriteCount();

            const claimKey = `agent/claims/${params.sessionId}`;
            const ttlMinutes = params.ttlMinutes ?? 30;
            const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
            await client.storeMemory(
              claimKey,
              JSON.stringify(params.keys),
              { sessionId: params.sessionId, claimedAt: Date.now() },
              { tags: ["session-claim"], expiresAt, priority: 0 },
            );
            const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
            return textResponse(
              JSON.stringify(
                {
                  sessionId: params.sessionId,
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

async function extractGitContext(
  client: ApiClient,
  lastSessionEndedAt?: unknown,
): Promise<{ commits?: string; diffStat?: string; todos?: string[] } | null> {
  const cwd = process.cwd();
  const result: { commits?: string; diffStat?: string; todos?: string[] } = {};

  try {
    // Get git log since last session
    const sinceArg = lastSessionEndedAt
      ? [`--since=${new Date(lastSessionEndedAt as number).toISOString()}`]
      : [];
    const logResult = await execFileAsync(
      "git",
      ["log", "--oneline", ...sinceArg, "-20"],
      { cwd, timeout: 5000 },
    );
    const commits = logResult.stdout.trim();
    if (commits) result.commits = commits;

    // Get diff stat for recent changes
    const diffResult = await execFileAsync(
      "git",
      ["diff", "--stat", "HEAD~10..HEAD"],
      { cwd, timeout: 5000 },
    ).catch(() => null);
    if (diffResult?.stdout.trim()) result.diffStat = diffResult.stdout.trim();

    // Extract TODOs/FIXMEs from recently changed files
    const changedResult = await execFileAsync(
      "git",
      ["diff", "--name-only", "HEAD~5..HEAD"],
      { cwd, timeout: 5000 },
    ).catch(() => null);
    if (changedResult?.stdout.trim()) {
      const changedFiles = changedResult.stdout
        .trim()
        .split("\n")
        .filter(Boolean);
      const todos: string[] = [];
      for (const file of changedFiles.slice(0, 20)) {
        try {
          const grepResult = await execFileAsync(
            "grep",
            ["-n", "-E", "TODO|FIXME|HACK|XXX", file],
            { cwd, timeout: 2000 },
          );
          if (grepResult.stdout.trim()) {
            for (const line of grepResult.stdout
              .trim()
              .split("\n")
              .slice(0, 5)) {
              todos.push(`${file}:${line}`);
            }
          }
        } catch {
          // grep returns exit code 1 when no matches
        }
      }
      if (todos.length > 0) result.todos = todos;
    }

    // Store git changes as auto-memory if we have meaningful content
    if (result.commits) {
      const timestamp = Date.now();
      const content = [
        result.commits ? `## Recent Commits\n${result.commits}` : "",
        result.diffStat ? `## Change Summary\n${result.diffStat}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await client
        .storeMemory(
          `auto:git-changes:${timestamp}`,
          content,
          { extractedAt: new Date().toISOString() },
          {
            tags: ["auto:git", "session-context"],
            priority: 20,
            expiresAt: Date.now() + 7 * 86_400_000,
          },
        )
        .catch(() => {});

      // Store TODOs separately if any
      if (result.todos?.length) {
        await client
          .storeMemory(
            `auto:todos:${timestamp}`,
            result.todos.join("\n"),
            { extractedAt: new Date().toISOString() },
            {
              tags: ["auto:git", "todos"],
              priority: 30,
              expiresAt: Date.now() + 14 * 86_400_000,
            },
          )
          .catch(() => {});
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
