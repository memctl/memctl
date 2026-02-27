import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";
import {
  buildAgentContextKey,
  extractAgentContextEntries,
  getAllContextTypeInfo,
  listAllMemories,
  normalizeAgentContextId,
  parseAgentsMd,
} from "../../agent-context.js";

export function registerImportExportTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
  onToolCall: (tool: string, action: string) => void,
) {
  server.tool(
    "import_export",
    "Import/export operations. Actions: agents_md_import, cursorrules_import, export_agents_md, export_memories",
    {
      action: z
        .enum([
          "agents_md_import",
          "cursorrules_import",
          "export_agents_md",
          "export_memories",
        ])
        .describe("Which operation to perform"),
      content: z
        .string()
        .optional()
        .describe("[agents_md_import,cursorrules_import] File content"),
      dryRun: z
        .boolean()
        .optional()
        .describe("[agents_md_import,cursorrules_import] Preview only"),
      overwrite: z
        .boolean()
        .optional()
        .describe("[agents_md_import,cursorrules_import] Overwrite existing"),
      source: z
        .enum(["cursorrules", "copilot"])
        .optional()
        .describe("[cursorrules_import] Source format"),
      format: z
        .enum(["agents_md", "cursorrules", "json"])
        .optional()
        .describe("[export_agents_md,export_memories] Output format"),
    },
    async (params) => {
      onToolCall("import_export", params.action);
      try {
        switch (params.action) {
          case "agents_md_import":
          case "cursorrules_import": {
            if (!params.content)
              return errorResponse("Missing param", "content required");
            const isCursorrules = params.action === "cursorrules_import";
            const source = isCursorrules
              ? ((params.source as string) ?? "cursorrules")
              : "agents_md";
            const sections = parseAgentsMd(params.content);

            if (params.dryRun) {
              return textResponse(
                JSON.stringify(
                  {
                    dryRun: true,
                    source,
                    sections: sections.map((s) => ({
                      type: s.type,
                      id: s.id,
                      title: s.title,
                      contentLength: s.content.length,
                      key: buildAgentContextKey(s.type, s.id),
                    })),
                    totalSections: sections.length,
                  },
                  null,
                  2,
                ),
              );
            }

            const results: Array<{ key: string; status: string }> = [];
            for (const section of sections) {
              const key = buildAgentContextKey(section.type, section.id);
              if (!params.overwrite) {
                try {
                  await client.getMemory(key);
                  results.push({ key, status: "skipped (exists)" });
                  continue;
                } catch {
                  /* ignore */
                }
              }
              try {
                await client.storeMemory(key, section.content, {
                  scope: "agent_functionality",
                  type: section.type,
                  id: normalizeAgentContextId(section.id),
                  title: section.title,
                  importedFrom: source,
                  updatedByTool: `import_export.${params.action}`,
                  updatedAt: new Date().toISOString(),
                });
                results.push({ key, status: "imported" });
              } catch (error) {
                results.push({
                  key,
                  status: `error: ${error instanceof Error ? error.message : String(error)}`,
                });
              }
            }

            return textResponse(
              JSON.stringify(
                {
                  source,
                  imported: results.filter((r) => r.status === "imported")
                    .length,
                  skipped: results.filter((r) => r.status.startsWith("skipped"))
                    .length,
                  errors: results.filter((r) => r.status.startsWith("error"))
                    .length,
                  details: results,
                },
                null,
                2,
              ),
            );
          }
          case "export_agents_md": {
            const format = (params.format as string) ?? "agents_md";
            const [allMemories, allTypeInfo] = await Promise.all([
              listAllMemories(client),
              getAllContextTypeInfo(client),
            ]);
            const entries = extractAgentContextEntries(allMemories);

            const byType: Record<string, typeof entries> = {};
            for (const entry of entries) {
              if (entry.type === "branch_plan") continue;
              if (!byType[entry.type]) byType[entry.type] = [];
              byType[entry.type].push(entry);
            }

            if (format === "json")
              return textResponse(JSON.stringify({ types: byType }, null, 2));

            const lines: string[] = [];
            if (format === "agents_md") {
              lines.push(
                "# AGENTS.md",
                "",
                "> Auto-generated from memctl structured agent context",
                "",
              );
            }

            for (const [type, typeEntries] of Object.entries(byType)) {
              const label = allTypeInfo[type]?.label ?? type;
              if (format === "agents_md") {
                lines.push(`## ${label}`, "");
                for (const entry of typeEntries) {
                  if (typeEntries.length > 1) {
                    lines.push(`### ${entry.title}`, "");
                  }
                  lines.push(entry.content, "");
                }
              } else {
                lines.push(`# ${label}`, "");
                for (const entry of typeEntries) {
                  lines.push(entry.content, "");
                }
              }
            }
            return textResponse(lines.join("\n"));
          }
          case "export_memories": {
            const format = (params.format as string) ?? "json";
            const result = await client.exportMemories(
              format as "agents_md" | "cursorrules" | "json",
            );
            if (typeof result === "string") return textResponse(result);
            const data = result as Record<string, unknown>;
            if (typeof data.content === "string")
              return textResponse(data.content);
            return textResponse(JSON.stringify(result, null, 2));
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in import_export.${params.action}`, error);
      }
    },
  );
}
