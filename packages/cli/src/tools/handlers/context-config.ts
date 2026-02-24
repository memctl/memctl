import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse } from "../response.js";
import {
  BUILTIN_AGENT_CONTEXT_TYPES,
  getAllContextTypeInfo,
  invalidateCustomTypesCache,
} from "../../agent-context.js";

export function registerContextConfigTool(
  server: McpServer,
  client: ApiClient,
  _rl: RateLimitState,
) {
  server.tool(
    "context_config",
    "Context type configuration. Actions: type_create, type_list, type_delete, template_get",
    {
      action: z
        .enum(["type_create", "type_list", "type_delete", "template_get"])
        .describe("Which operation to perform"),
      slug: z
        .string()
        .optional()
        .describe("[type_create,type_delete] Type slug"),
      label: z
        .string()
        .optional()
        .describe("[type_create] Human-readable label"),
      description: z.string().optional().describe("[type_create] Description"),
      type: z
        .string()
        .optional()
        .describe("[template_get] Context type for template"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "type_create": {
            if (!params.slug || !params.label || !params.description)
              return errorResponse(
                "Missing params",
                "slug, label, and description required",
              );
            if (
              (BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]).includes(
                params.slug,
              )
            )
              return errorResponse(
                "Error",
                `"${params.slug}" is a built-in type and cannot be overridden.`,
              );
            await client.createContextType({
              slug: params.slug,
              label: params.label,
              description: params.description,
            });
            invalidateCustomTypesCache();
            return textResponse(
              `Custom context type created: ${params.slug} ("${params.label}")`,
            );
          }
          case "type_list": {
            const allTypeInfo = await getAllContextTypeInfo(client);
            const builtinSlugs = new Set(
              BUILTIN_AGENT_CONTEXT_TYPES as readonly string[],
            );
            const types = Object.entries(allTypeInfo).map(([slug, info]) => ({
              slug,
              label: info.label,
              description: info.description,
              isBuiltin: builtinSlugs.has(slug),
            }));
            return textResponse(JSON.stringify({ types }, null, 2));
          }
          case "type_delete": {
            if (!params.slug)
              return errorResponse("Missing param", "slug required");
            if (
              (BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]).includes(
                params.slug,
              )
            )
              return errorResponse(
                "Error",
                `"${params.slug}" is a built-in type and cannot be deleted.`,
              );
            await client.deleteContextType(params.slug);
            invalidateCustomTypesCache();
            return textResponse(`Custom context type deleted: ${params.slug}`);
          }
          case "template_get": {
            if (!params.type)
              return errorResponse("Missing param", "type required");
            return handleTemplateGet(client, params.type);
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in context_config.${params.action}`, error);
      }
    },
  );
}

async function handleTemplateGet(client: ApiClient, type: string) {
  const templates: Record<string, { description: string; template: string }> = {
    coding_style: {
      description: "Coding conventions and style guide",
      template:
        "## Language & Framework\n-\n\n## Naming Conventions\n-\n\n## Formatting\n-\n\n## Patterns to Follow\n-\n\n## Anti-patterns to Avoid\n-",
    },
    architecture: {
      description: "System architecture and design decisions",
      template:
        "## Overview\n-\n\n## Module Boundaries\n-\n\n## Data Flow\n-\n\n## Key Design Decisions\n-\n\n## Dependencies\n-",
    },
    testing: {
      description: "Testing strategy and requirements",
      template:
        "## Test Framework\n-\n\n## Required Coverage\n-\n\n## Test Locations\n-\n\n## Running Tests\n```bash\n```\n\n## Testing Conventions\n-",
    },
    constraints: {
      description: "Hard rules and safety limits",
      template:
        "## Must Do\n-\n\n## Must Not Do\n-\n\n## Security Requirements\n-\n\n## Performance Requirements\n-",
    },
    lessons_learned: {
      description: "Pitfalls and negative knowledge",
      template:
        "## What Happened\n-\n\n## Why It Failed\n-\n\n## What to Do Instead\n-\n\n## Files/Areas Affected\n-",
    },
    workflow: {
      description: "Development workflow and processes",
      template:
        "## Branching Strategy\n-\n\n## PR Process\n-\n\n## Deployment\n-\n\n## Code Review\n-",
    },
    folder_structure: {
      description: "Repository organization",
      template:
        "## Root Layout\n```\n/\n```\n\n## Key Directories\n-\n\n## Where to Put New Code\n-",
    },
    file_map: {
      description: "Key file locations",
      template:
        "## Entry Points\n-\n\n## Configuration Files\n-\n\n## API Endpoints\n-\n\n## Database\n-",
    },
  };

  const tmpl = templates[type];
  if (!tmpl) {
    const allTypeInfo = await getAllContextTypeInfo(client);
    const info = allTypeInfo[type];
    if (info)
      return textResponse(
        JSON.stringify(
          {
            type,
            label: info.label,
            description: info.description,
            template: `## ${info.label}\n\n${info.description}\n\n## Content\n-`,
            note: "Generic template for custom type.",
          },
          null,
          2,
        ),
      );
    return errorResponse(
      "Error",
      `Unknown type "${type}". Use context_config type_list to see available types.`,
    );
  }
  return textResponse(
    JSON.stringify(
      {
        type,
        description: tmpl.description,
        template: tmpl.template,
        usage: `Use context functionality_set with type="${type}" and the filled-in template.`,
      },
      null,
      2,
    ),
  );
}
