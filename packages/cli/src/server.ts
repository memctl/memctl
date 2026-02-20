import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "./api-client.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

function registerPrompts(server: McpServer) {
  server.prompt(
    "agent-startup",
    "Auto-injected startup context for AI coding agents. Call agent_bootstrap to load all project context, then session_start to register this session.",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You have access to memctl — a persistent memory system for coding agents.

**On session start:**
1. Call \`agent_bootstrap\` to load all project context (architecture, coding style, constraints, file map, etc.)
2. Call \`session_start\` with a unique session ID to register this session and get the previous session's handoff summary
3. Check \`memory_watch\` for any keys you're interested in to detect concurrent changes

**During work:**
- Use \`agent_context_for\` before modifying files to get relevant constraints and patterns
- Store new knowledge with \`agent_functionality_set\` (coding_style, architecture, lessons_learned, etc.)
- Use \`memory_check_duplicates\` before creating new memories to avoid redundancy
- Use \`context_budget\` to retrieve context that fits within your token limit

**On session end:**
- Call \`session_end\` with a summary of what you accomplished, decisions made, and open questions
- This ensures the next agent session has continuity

**Negative knowledge:**
- When you discover something that failed or should be avoided, store it as type \`lessons_learned\`
- These entries help prevent future agents from repeating mistakes`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "context-for-files",
    "Get relevant project context before modifying specific files",
    {
      files: z.string().describe("Comma-separated file paths you plan to modify"),
    },
    ({ files }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Before modifying these files, retrieve relevant context:

Files: ${files}

Call \`agent_context_for\` with these file paths to get matching architecture, coding style, testing, and constraint entries. Follow any constraints and patterns found.`,
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
            text: `Please generate a session handoff summary. Include:

1. **What was accomplished** — key changes, features added, bugs fixed
2. **Key decisions made** — architectural choices, trade-offs accepted
3. **Open questions** — unresolved issues, things to investigate
4. **Modified files** — list of files changed
5. **Memory keys written** — any new context entries stored

Then call \`session_end\` with this summary to save it for the next session.`,
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
  const server = new McpServer({
    name: "memctl",
    version: "0.1.0",
  });

  const client = new ApiClient(config);

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
  client.ping().then((online) => {
    if (!online) {
      process.stderr.write(
        "[memctl] Warning: API unreachable — running in offline mode with local cache\n",
      );
    }
  }).catch(() => {});

  return server;
}
