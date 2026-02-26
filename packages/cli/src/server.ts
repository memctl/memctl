import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "./api-client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import {
  createSessionTracker,
  trackApiCall,
  finalizeSession,
  startSessionLifecycle,
} from "./session-tracker.js";

function registerPrompts(server: McpServer) {
  server.prompt(
    "agent-startup",
    "Auto-injected startup context for AI coding agents. Call context bootstrap to begin.",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Use memctl MCP tools for ALL persistent memory. Do NOT use built-in auto memory or MEMORY.md files. Do NOT store code, git output, file contents, or command results in memory.

Session start: context action=bootstrap, activity action=memo_read, branch action=get.
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
  const tracker = createSessionTracker();
  const server = new McpServer({
    name: "memctl",
    version: "0.1.0",
  });

  const client = new ApiClient({
    ...config,
    onRequest: ({ method, path, body }) => {
      trackApiCall(tracker, method, path, body);
    },
  });
  startSessionLifecycle(client, tracker);

  registerTools(server, client, tracker);
  registerResources(server, client, tracker);
  registerPrompts(server);

  // MCP disconnect detection
  server.server.onclose = () => {
    void finalizeSession(client, tracker);
  };

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

  // Attempt API ping on startup -- enter offline mode if unreachable
  client
    .ping()
    .then(async (online) => {
      if (!online) {
        process.stderr.write(
          "[memctl] Warning: API unreachable -- running in offline mode with local cache\n",
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
