import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ApiClient } from "./api-client.js";

const execFileAsync = promisify(execFile);

// ── Built-in Agent Context Types ───────────────────────────────

export const BUILTIN_AGENT_CONTEXT_TYPES = [
  "coding_style",
  "folder_structure",
  "file_map",
  "architecture",
  "workflow",
  "testing",
  "branch_plan",
  "constraints",
  "lessons_learned",
] as const;

export type BuiltinAgentContextType =
  (typeof BUILTIN_AGENT_CONTEXT_TYPES)[number];

// For backward compatibility
export const AGENT_CONTEXT_TYPES = BUILTIN_AGENT_CONTEXT_TYPES;
export type AgentContextType = string; // Now accepts both built-in and custom types

export const AGENT_CONTEXT_TYPE_INFO: Record<
  BuiltinAgentContextType,
  { label: string; description: string }
> = {
  coding_style: {
    label: "Coding Style",
    description:
      "Conventions, naming rules, formatting, and review expectations.",
  },
  folder_structure: {
    label: "Folder Structure",
    description: "How the repository is organized and where core domains live.",
  },
  file_map: {
    label: "File Map",
    description:
      "Quick index of where to find key features, APIs, and configs.",
  },
  architecture: {
    label: "Architecture",
    description:
      "Core system design, module boundaries, and data flow decisions.",
  },
  workflow: {
    label: "Workflow",
    description:
      "Branching, PR flow, deployment process, and team working norms.",
  },
  testing: {
    label: "Testing",
    description: "Test strategy, required checks, and where tests are located.",
  },
  branch_plan: {
    label: "Branch Plan",
    description: "What needs to be implemented in a specific git branch.",
  },
  constraints: {
    label: "Constraints",
    description:
      "Hard requirements, non-goals, and safety limits for agent changes.",
  },
  lessons_learned: {
    label: "Lessons Learned",
    description:
      "Pitfalls, gotchas, and negative knowledge — things that failed or should be avoided.",
  },
};

// ── Custom Type Support ────────────────────────────────────────

export interface CustomContextType {
  slug: string;
  label: string;
  description: string;
  schema?: string | null;
  icon?: string | null;
}

let cachedCustomTypes: CustomContextType[] | null = null;
let customTypesCacheTime = 0;
const CUSTOM_TYPES_CACHE_TTL = 60_000; // 1 minute

export async function getCustomContextTypes(
  client: ApiClient,
): Promise<CustomContextType[]> {
  const now = Date.now();
  if (
    cachedCustomTypes &&
    now - customTypesCacheTime < CUSTOM_TYPES_CACHE_TTL
  ) {
    return cachedCustomTypes;
  }

  try {
    const result = await client.listContextTypes();
    cachedCustomTypes = result.contextTypes.map((t) => ({
      slug: t.slug,
      label: t.label,
      description: t.description,
      schema: t.schema,
      icon: t.icon,
    }));
    customTypesCacheTime = now;
    return cachedCustomTypes;
  } catch {
    return cachedCustomTypes ?? [];
  }
}

export function invalidateCustomTypesCache() {
  cachedCustomTypes = null;
}

export async function getAllContextTypeInfo(
  client: ApiClient,
): Promise<Record<string, { label: string; description: string }>> {
  const customTypes = await getCustomContextTypes(client);
  const all: Record<string, { label: string; description: string }> = {
    ...AGENT_CONTEXT_TYPE_INFO,
  };
  for (const ct of customTypes) {
    all[ct.slug] = { label: ct.label, description: ct.description };
  }
  return all;
}

export async function getAllContextTypeSlugs(
  client: ApiClient,
): Promise<string[]> {
  const customTypes = await getCustomContextTypes(client);
  return [...BUILTIN_AGENT_CONTEXT_TYPES, ...customTypes.map((t) => t.slug)];
}

export function isBuiltinType(type: string): type is BuiltinAgentContextType {
  return (BUILTIN_AGENT_CONTEXT_TYPES as readonly string[]).includes(type);
}

// ── Memory Records ─────────────────────────────────────────────

const AGENT_CONTEXT_PREFIX = "agent/context";

export interface MemoryRecord {
  key: string;
  content?: string | null;
  metadata?: unknown;
  scope?: string;
  priority?: number | null;
  tags?: string | null;
  relatedKeys?: string | null;
  pinnedAt?: unknown;
  archivedAt?: unknown;
  expiresAt?: unknown;
  accessCount?: number;
  lastAccessedAt?: unknown;
  helpfulCount?: number;
  unhelpfulCount?: number;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface AgentContextEntry {
  type: string;
  id: string;
  key: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  priority: number;
  tags: string[];
  updatedAt: unknown;
  createdAt: unknown;
}

export function normalizeAgentContextId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._%-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildAgentContextKey(type: string, id: string) {
  return `${AGENT_CONTEXT_PREFIX}/${type}/${normalizeAgentContextId(id)}`;
}

export function buildBranchPlanKey(branchName: string) {
  return buildAgentContextKey("branch_plan", encodeURIComponent(branchName));
}

export function parseAgentContextKey(key: string) {
  const parts = key.split("/");
  if (parts.length !== 4) return null;
  if (parts[0] !== "agent" || parts[1] !== "context") return null;
  const type = parts[2];
  if (!type) return null;
  const id = parts[3];
  if (!id) return null;
  return { type, id };
}

function parseMetadata(input: unknown): Record<string, unknown> | null {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return null;
}

function parseTags(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(input)) return input;
  return [];
}

export async function listAllMemories(client: ApiClient, maxMemories = 2_000) {
  const pageSize = 100;
  let offset = 0;
  const all: MemoryRecord[] = [];

  while (all.length < maxMemories) {
    const response = (await client.listMemories(pageSize, offset)) as {
      memories?: MemoryRecord[];
    };
    const batch = response.memories ?? [];
    all.push(...batch);

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all.slice(0, maxMemories);
}

export function extractAgentContextEntries(memories: MemoryRecord[]) {
  const entries: AgentContextEntry[] = [];

  for (const memory of memories) {
    const parsed = parseAgentContextKey(memory.key);
    if (!parsed) continue;

    const metadata = parseMetadata(memory.metadata);
    const rawTitle = metadata?.title;
    const title =
      typeof rawTitle === "string" && rawTitle.trim().length > 0
        ? rawTitle
        : parsed.id;

    entries.push({
      type: parsed.type,
      id: parsed.id,
      key: memory.key,
      title,
      content: memory.content ?? "",
      metadata,
      priority: typeof memory.priority === "number" ? memory.priority : 0,
      tags: parseTags(memory.tags),
      updatedAt: memory.updatedAt ?? null,
      createdAt: memory.createdAt ?? null,
    });
  }

  // Sort by priority descending (highest first)
  entries.sort((a, b) => b.priority - a.priority);

  return entries;
}

// ── Git Integration ────────────────────────────────────────────

async function runGit(args: string[], cwd = process.cwd()) {
  try {
    const result = await execFileAsync("git", args, { cwd });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

export async function getBranchInfo(cwd = process.cwd()) {
  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (!branch || branch === "HEAD") return null;

  const commit = await runGit(["rev-parse", "HEAD"], cwd);
  const porcelain = await runGit(["status", "--porcelain"], cwd);
  const upstream = await runGit(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    cwd,
  );

  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await runGit(
      ["rev-list", "--left-right", "--count", `HEAD...${upstream}`],
      cwd,
    );
    if (counts) {
      const [behindRaw, aheadRaw] = counts.split(/\s+/);
      behind = Number.parseInt(behindRaw ?? "0", 10) || 0;
      ahead = Number.parseInt(aheadRaw ?? "0", 10) || 0;
    }
  }

  return {
    branch,
    branchKeyId: encodeURIComponent(branch),
    commit,
    dirty: Boolean(porcelain && porcelain.length > 0),
    upstream: upstream ?? null,
    ahead,
    behind,
  };
}

// ── AGENTS.md Parser ───────────────────────────────────────────

export interface ParsedAgentsMdSection {
  type: string;
  id: string;
  title: string;
  content: string;
}

/**
 * Parse an AGENTS.md / CLAUDE.md file into structured sections.
 * Maps common heading patterns to agent context types.
 */
export function parseAgentsMd(content: string): ParsedAgentsMdSection[] {
  const sections: ParsedAgentsMdSection[] = [];
  const lines = content.split("\n");

  // Heading-to-type mapping
  const headingTypeMap: Record<string, string> = {
    "coding style": "coding_style",
    "code style": "coding_style",
    "style guide": "coding_style",
    conventions: "coding_style",
    naming: "coding_style",
    formatting: "coding_style",
    "folder structure": "folder_structure",
    "project structure": "folder_structure",
    "directory structure": "folder_structure",
    "file structure": "folder_structure",
    "repository structure": "folder_structure",
    "file map": "file_map",
    "key files": "file_map",
    "important files": "file_map",
    architecture: "architecture",
    "system design": "architecture",
    design: "architecture",
    overview: "architecture",
    workflow: "workflow",
    "development workflow": "workflow",
    branching: "workflow",
    "pr flow": "workflow",
    deployment: "workflow",
    "ci/cd": "workflow",
    testing: "testing",
    tests: "testing",
    "test strategy": "testing",
    "test setup": "testing",
    constraints: "constraints",
    rules: "constraints",
    requirements: "constraints",
    "non-goals": "constraints",
    limitations: "constraints",
    safety: "constraints",
    "do not": "constraints",
    "don't": "constraints",
    "lessons learned": "lessons_learned",
    pitfalls: "lessons_learned",
    gotchas: "lessons_learned",
    mistakes: "lessons_learned",
    "what not to do": "lessons_learned",
    failed: "lessons_learned",
    avoid: "lessons_learned",
  };

  let currentSection: ParsedAgentsMdSection | null = null;
  let contentLines: string[] = [];

  function flushSection() {
    if (currentSection) {
      currentSection.content = contentLines.join("\n").trim();
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
    }
    contentLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushSection();

      const title = headingMatch[2].trim();
      const titleLower = title.toLowerCase();

      // Find best matching type
      let bestType = "architecture"; // default fallback
      for (const [pattern, type] of Object.entries(headingTypeMap)) {
        if (titleLower.includes(pattern)) {
          bestType = type;
          break;
        }
      }

      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      currentSection = {
        type: bestType,
        id: id || "general",
        title,
        content: "",
      };
    } else {
      contentLines.push(line);
    }
  }

  flushSection();

  // If no sections were found (no headings), treat entire content as architecture
  if (sections.length === 0 && content.trim().length > 0) {
    sections.push({
      type: "architecture",
      id: "general",
      title: "General",
      content: content.trim(),
    });
  }

  return sections;
}
