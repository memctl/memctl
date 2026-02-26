export const DEFAULT_AGENTS_MD_TEMPLATE = `# memctl Rules

MCP server: \`memctl\`. Use it for all persistent project memory.

## Session Start

1. \`context\` action=\`bootstrap\` -- load project context
2. \`activity\` action=\`memo_read\` -- check handoff notes
3. \`branch\` action=\`get\` includeRelatedContext=\`true\`

## Before Editing

- \`context\` action=\`context_for\` filePaths=\`[<files you will edit>]\`
- \`context\` action=\`smart_retrieve\` intent=\`<what you need>\`

## While Coding

- Store decisions, lessons, issues: \`context\` action=\`functionality_set\` type=\`<type>\` id=\`<id>\` content=\`<content>\`
- Search before storing: \`memory\` action=\`search\` query=\`<query>\`
- Update branch plan: \`branch\` action=\`set\` content=\`<plan>\` status=\`in_progress\`

## After Completing Work

- Store lessons: \`context\` action=\`functionality_set\` type=\`lessons_learned\` id=\`<id>\` content=\`<lesson>\`

## Session End (MANDATORY)

You MUST execute these steps after fully responding to the user. Never skip this.

1. \`activity\` action=\`memo_leave\` message=\`<handoff note>\`
2. \`session\` action=\`end\` summary=\`<structured summary>\`

Summary must include: what was accomplished, key decisions made, open questions, and what files were modified. Keep it concise (1-2 paragraphs). Do NOT include code snippets, file contents, git output, or command results.

## Rules

- Always bootstrap at session start
- Always end session before stopping, no exceptions
- Always load context before editing files
- Never store secrets, tokens, or API keys
- Search before storing to avoid duplicates
- Do not store code, file contents, git output, or command results in memory
`;

const FRONTMATTER: Record<string, string> = {
  windsurf: `---
trigger: always_on
description: memctl persistent memory protocol
---\n`,
  cursor_rule: `---
description: memctl persistent memory protocol
alwaysApply: true
---\n`,
  copilot: `---
applyTo: "**"
name: memctl
description: memctl persistent memory protocol
---\n`,
};

export function wrapForTool(content: string, tool: string): string {
  const fm = FRONTMATTER[tool];
  if (!fm) return content;
  return fm + content;
}
