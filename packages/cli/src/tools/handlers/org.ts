import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";

export function registerOrgTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
  onToolCall: (tool: string, action: string) => void,
) {
  server.tool(
    "org",
    "Organization operations. Actions: defaults_list, defaults_set, defaults_apply, context_diff, template_list, template_apply, template_create",
    {
      action: z
        .enum([
          "defaults_list",
          "defaults_set",
          "defaults_apply",
          "context_diff",
          "template_list",
          "template_apply",
          "template_create",
        ])
        .describe("Which operation to perform"),
      key: z
        .string()
        .optional()
        .describe("[defaults_set] Memory key for the default"),
      content: z.string().optional().describe("[defaults_set] Default content"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("[defaults_set] Optional metadata"),
      priority: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("[defaults_set] Default priority"),
      tags: z
        .array(z.string())
        .optional()
        .describe("[defaults_set] Default tags"),
      projectA: z
        .string()
        .optional()
        .describe("[context_diff] Slug of first project"),
      projectB: z
        .string()
        .optional()
        .describe("[context_diff] Slug of second project"),
      templateId: z
        .string()
        .optional()
        .describe("[template_apply] ID of the template to apply"),
      name: z.string().optional().describe("[template_create] Template name"),
      description: z
        .string()
        .optional()
        .describe("[template_create] Template description"),
      data: z
        .array(
          z.object({
            key: z.string(),
            content: z.string(),
            metadata: z.record(z.unknown()).optional(),
            priority: z.number().optional(),
            tags: z.array(z.string()).optional(),
          }),
        )
        .optional()
        .describe("[template_create] Array of memory entries for the template"),
    },
    async (params) => {
      onToolCall("org", params.action);
      try {
        switch (params.action) {
          case "defaults_list": {
            const result = await client.listOrgDefaults();
            return textResponse(
              JSON.stringify(
                {
                  count: result.defaults.length,
                  defaults: result.defaults.map((d) => ({
                    key: d.key,
                    priority: d.priority,
                    tags: d.tags,
                    contentPreview: d.content.slice(0, 120),
                    updatedAt: d.updatedAt,
                  })),
                },
                null,
                2,
              ),
            );
          }
          case "defaults_set": {
            if (!params.key || !params.content)
              return errorResponse(
                "Missing params",
                "key and content required",
              );
            await client.setOrgDefault({
              key: params.key,
              content: params.content,
              metadata: params.metadata,
              priority: params.priority,
              tags: params.tags,
            });
            return textResponse(`Org default set: ${params.key}`);
          }
          case "defaults_apply": {
            const result = await client.applyOrgDefaults();
            return textResponse(
              JSON.stringify(
                {
                  applied: result.applied,
                  memoriesCreated: result.memoriesCreated,
                  memoriesUpdated: result.memoriesUpdated,
                  totalDefaults: result.totalDefaults,
                  message: `Applied ${result.totalDefaults} org defaults: ${result.memoriesCreated} created, ${result.memoriesUpdated} updated.`,
                },
                null,
                2,
              ),
            );
          }
          case "context_diff": {
            if (!params.projectA || !params.projectB)
              return errorResponse(
                "Missing params",
                "projectA and projectB required",
              );
            const result = await client.orgContextDiff(
              params.projectA,
              params.projectB,
            );
            const hints: string[] = [];
            if (result.stats.onlyInA > 0)
              hints.push(
                `${result.stats.onlyInA} memories unique to ${params.projectA}`,
              );
            if (result.stats.onlyInB > 0)
              hints.push(
                `${result.stats.onlyInB} memories unique to ${params.projectB}`,
              );
            if (result.stats.contentDiffers > 0)
              hints.push(
                `${result.stats.contentDiffers} shared keys have different content — review for alignment`,
              );
            return textResponse(
              JSON.stringify(
                {
                  ...result,
                  hint:
                    hints.length > 0
                      ? hints.join(". ") + "."
                      : `Projects ${params.projectA} and ${params.projectB} are fully aligned.`,
                },
                null,
                2,
              ),
            );
          }
          case "template_list": {
            const result = await client.listTemplates();
            return textResponse(
              JSON.stringify(
                {
                  templates: result.templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    entryCount: Array.isArray(t.data) ? t.data.length : 0,
                    isBuiltin: t.isBuiltin,
                  })),
                },
                null,
                2,
              ),
            );
          }
          case "template_apply": {
            if (!params.templateId)
              return errorResponse("Missing param", "templateId required");
            const result = await client.applyTemplate(params.templateId);
            return textResponse(
              JSON.stringify(
                {
                  applied: result.applied,
                  templateName: result.templateName,
                  memoriesCreated: result.memoriesCreated,
                  memoriesUpdated: result.memoriesUpdated,
                  message: `Template "${result.templateName}" applied: ${result.memoriesCreated} created, ${result.memoriesUpdated} updated.`,
                },
                null,
                2,
              ),
            );
          }
          case "template_create": {
            if (!params.name || !params.data?.length)
              return errorResponse("Missing params", "name and data required");
            const result = await client.createTemplate(
              params.name,
              params.description,
              params.data as Array<Record<string, unknown>>,
            );
            return textResponse(
              JSON.stringify(
                {
                  created: true,
                  templateId: result.template.id,
                  templateName: result.template.name,
                  entryCount: params.data.length,
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
        return errorResponse(`Error in org.${params.action}`, error);
      }
    },
  );
}
