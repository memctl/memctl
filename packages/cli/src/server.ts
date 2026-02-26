import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "./api-client.js";
import { getBranchInfo } from "./agent-context.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

const AUTO_SESSION_PREFIX = "auto";
const AUTO_SESSION_FLUSH_INTERVAL_MS = 30_000;

type AutoSessionTracker = {
  sessionId: string;
  readKeys: Set<string>;
  writtenKeys: Set<string>;
  areas: Set<string>;
  apiCallCount: number;
  dirty: boolean;
  closed: boolean;
  startedAt: number;
};

function createAutoSessionTracker(): AutoSessionTracker {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    sessionId: `${AUTO_SESSION_PREFIX}-${now.toString(36)}-${rand}`,
    readKeys: new Set<string>(),
    writtenKeys: new Set<string>(),
    areas: new Set<string>(),
    apiCallCount: 0,
    dirty: false,
    closed: false,
    startedAt: now,
  };
}

function getPathWithoutQuery(path: string): string {
  const idx = path.indexOf("?");
  return idx >= 0 ? path.slice(0, idx) : path;
}

function getAreaFromPath(path: string): string | null {
  const clean = getPathWithoutQuery(path).replace(/^\/+/, "");
  if (!clean) return null;
  const area = clean.split("/")[0];
  return area || null;
}

function shouldTrackMemoryKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith("agent/claims/")) return false;
  if (key.startsWith("auto:")) return false;
  return true;
}

function extractKeyFromPath(method: string, path: string): {
  readKey?: string;
  writtenKey?: string;
} {
  const cleanPath = getPathWithoutQuery(path);
  const match = cleanPath.match(/^\/memories\/([^/]+)$/);
  if (!match) return {};

  const raw = match[1];
  if (!raw) return {};
  const key = decodeURIComponent(raw);
  if (!shouldTrackMemoryKey(key)) return {};

  const upperMethod = method.toUpperCase();
  if (upperMethod === "GET") return { readKey: key };
  if (
    upperMethod === "POST" ||
    upperMethod === "PATCH" ||
    upperMethod === "DELETE"
  ) {
    return { writtenKey: key };
  }
  return {};
}

function extractKeyFromBody(method: string, path: string, body?: unknown): {
  readKey?: string;
  writtenKey?: string;
} {
  if (!body || typeof body !== "object") return {};
  const cleanPath = getPathWithoutQuery(path);
  const upperMethod = method.toUpperCase();
  const payload = body as Record<string, unknown>;

  if (upperMethod === "POST" && cleanPath === "/memories") {
    const key = typeof payload.key === "string" ? payload.key : "";
    if (shouldTrackMemoryKey(key)) {
      return { writtenKey: key };
    }
  }

  if (upperMethod === "POST" && cleanPath === "/memories/bulk") {
    const keys = Array.isArray(payload.keys) ? payload.keys : [];
    const first = keys.find((k) => typeof k === "string") as string | undefined;
    if (first && shouldTrackMemoryKey(first)) {
      return { readKey: first };
    }
  }

  return {};
}

function buildAutoSummary(tracker: AutoSessionTracker): string {
  const durationMs = Math.max(0, Date.now() - tracker.startedAt);
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  const areas = [...tracker.areas].sort();
  const parts = [
    `Auto-captured session activity for ${minutes} min`,
    `${tracker.apiCallCount} API call(s)`,
    `${tracker.writtenKeys.size} key(s) written`,
    `${tracker.readKeys.size} key(s) read`,
  ];
  if (areas.length > 0) {
    parts.push(`areas: ${areas.join(", ")}`);
  }
  return `${parts.join(", ")}.`;
}

async function flushAutoSession(
  client: ApiClient,
  tracker: AutoSessionTracker,
  final: boolean,
): Promise<void> {
  if (tracker.closed) return;
  if (!tracker.dirty && !final) return;

  try {
    await client.upsertSessionLog({
      sessionId: tracker.sessionId,
      summary: buildAutoSummary(tracker),
      keysRead: [...tracker.readKeys],
      keysWritten: [...tracker.writtenKeys],
      toolsUsed: [...tracker.areas],
      endedAt: final ? Date.now() : undefined,
    });
    tracker.dirty = false;
    if (final) {
      tracker.closed = true;
    }
  } catch {
    // Best effort only, do not fail MCP server startup/shutdown.
  }
}

function startAutoSessionLifecycle(client: ApiClient, tracker: AutoSessionTracker) {
  void getBranchInfo()
    .then(async (branchInfo) => {
      await client.upsertSessionLog({
        sessionId: tracker.sessionId,
        branch: branchInfo?.branch,
      });
    })
    .catch(async () => {
      try {
        await client.upsertSessionLog({ sessionId: tracker.sessionId });
      } catch {
        // Best effort only, do not crash MCP server.
      }
    });

  const interval = setInterval(() => {
    void flushAutoSession(client, tracker, false);
  }, AUTO_SESSION_FLUSH_INTERVAL_MS);
  interval.unref();

  const finalize = () => {
    clearInterval(interval);
    void flushAutoSession(client, tracker, true);
  };

  process.once("beforeExit", finalize);
  process.once("SIGINT", finalize);
  process.once("SIGTERM", finalize);
}

function registerPrompts(server: McpServer) {
  server.prompt(
    "agent-startup",
    "Auto-injected startup context for AI coding agents. Call context bootstrap, then session start.",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Use memctl MCP tools for ALL persistent memory. Do NOT use built-in auto memory or MEMORY.md files. Do NOT store code, git output, file contents, or command results in memory.

Session start: context action=bootstrap, session action=start, activity action=memo_read, branch action=get.
Before editing: context action=context_for filePaths=[files], context action=smart_retrieve intent=<what you need>.
Store decisions/lessons/issues: context action=functionality_set type=<type> id=<id> content=<content>.
Search before storing: memory action=search query=<query>.

MANDATORY SESSION END: After fully responding to the user, you MUST execute these steps. Never skip this.
1. activity action=memo_leave message=<handoff note with what was done and what is pending>
2. session action=end sessionId=<id> summary=<what was accomplished, key decisions made, open questions, files modified>
Keep the summary concise (1-2 paragraphs). Do NOT include code snippets, file contents, git output, or command results in the summary.

Only store things useful across sessions: decisions, lessons, issues, user preferences, architecture notes.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "context-for-files",
    "Get relevant project context before modifying specific files",
    {
      files: z
        .string()
        .describe("Comma-separated file paths you plan to modify"),
    },
    ({ files }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Before modifying these files, retrieve relevant context:

Files: ${files}

Call \`context\` with \`{"action":"context_for","filePaths":[...]} \` using these file paths to get matching architecture, coding style, testing, and constraint entries. Follow any constraints and patterns found.`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "session-handoff",
    "Generate a session handoff summary for continuity",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a session handoff summary. Include:

1. What was accomplished, key changes, features added, bugs fixed
2. Key decisions made, architectural choices, trade-offs accepted
3. Open questions, unresolved issues, things to investigate
4. Modified files

Do NOT include code snippets, file contents, git output, or command results. Keep it concise (1-2 paragraphs).

Then call:
1. \`activity\` with \`{"action":"memo_leave","message":"<handoff note>"}\`
2. \`session\` with \`{"action":"end","sessionId":"<same-id>","summary":"<summary>"}\``,
          },
        },
      ],
    }),
  );
}

export function createServer(config: {
  baseUrl: string;
  token: string;
  org: string;
  project: string;
}) {
  const autoTracker = createAutoSessionTracker();
  const server = new McpServer({
    name: "memctl",
    version: "0.1.0",
  });

  const client = new ApiClient({
    ...config,
    onRequest: ({ method, path, body }) => {
      const area = getAreaFromPath(path);
      if (area === "health" || area === "session-logs") return;

      autoTracker.apiCallCount += 1;
      if (area) autoTracker.areas.add(area);

      const fromPath = extractKeyFromPath(method, path);
      const fromBody = extractKeyFromBody(method, path, body);
      const readKey = fromPath.readKey ?? fromBody.readKey;
      const writtenKey = fromPath.writtenKey ?? fromBody.writtenKey;
      if (readKey) autoTracker.readKeys.add(readKey);
      if (writtenKey) autoTracker.writtenKeys.add(writtenKey);
      autoTracker.dirty = true;
    },
  });
  startAutoSessionLifecycle(client, autoTracker);

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  // Connection status resource
  server.resource(
    "connection_status",
    "memctl://connection-status",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(client.getConnectionStatus()),
          mimeType: "application/json",
        },
      ],
    }),
  );

  // Attempt API ping on startup — enter offline mode if unreachable
  client
    .ping()
    .then(async (online) => {
      if (!online) {
        process.stderr.write(
          "[memctl] Warning: API unreachable — running in offline mode with local cache\n",
        );
        return;
      }

      // Incremental sync: if we have a previous sync timestamp, fetch only delta
      try {
        const lastSync = client.getLocalCacheSyncAt();
        if (lastSync > 0) {
          const stats = await client.incrementalSync();
          process.stderr.write(
            `[memctl] Incremental sync: +${stats.created} created, ~${stats.updated} updated, -${stats.deleted} deleted\n`,
          );
        } else {
          // First run: do full list to populate cache
          await client.listMemories(100);
        }
      } catch {
        // Sync failure is non-critical
      }
    })
    .catch(() => {});

  return server;
}
