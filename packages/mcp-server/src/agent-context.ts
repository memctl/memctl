import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ApiClient } from "./api-client.js";

const execFileAsync = promisify(execFile);

export const AGENT_CONTEXT_TYPES = [
  "coding_style",
  "folder_structure",
  "file_map",
  "architecture",
  "workflow",
  "testing",
  "branch_plan",
  "constraints",
] as const;

export type AgentContextType = (typeof AGENT_CONTEXT_TYPES)[number];

export const AGENT_CONTEXT_TYPE_INFO: Record<
  AgentContextType,
  { label: string; description: string }
> = {
  coding_style: {
    label: "Coding Style",
    description: "Conventions, naming rules, formatting, and review expectations.",
  },
  folder_structure: {
    label: "Folder Structure",
    description: "How the repository is organized and where core domains live.",
  },
  file_map: {
    label: "File Map",
    description: "Quick index of where to find key features, APIs, and configs.",
  },
  architecture: {
    label: "Architecture",
    description: "Core system design, module boundaries, and data flow decisions.",
  },
  workflow: {
    label: "Workflow",
    description: "Branching, PR flow, deployment process, and team working norms.",
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
    description: "Hard requirements, non-goals, and safety limits for agent changes.",
  },
};

const AGENT_CONTEXT_PREFIX = "agent/context";

export interface MemoryRecord {
  key: string;
  content?: string | null;
  metadata?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface AgentContextEntry {
  type: AgentContextType;
  id: string;
  key: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
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

export function buildAgentContextKey(type: AgentContextType, id: string) {
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
  if (!AGENT_CONTEXT_TYPES.includes(type as AgentContextType)) return null;
  const id = parts[3];
  if (!id) return null;
  return { type: type as AgentContextType, id };
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

export async function listAllMemories(client: ApiClient, maxMemories = 2_000) {
  const pageSize = 100;
  let offset = 0;
  const all: MemoryRecord[] = [];

  while (all.length < maxMemories) {
    const response = await client.listMemories(pageSize, offset) as {
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
      updatedAt: memory.updatedAt ?? null,
      createdAt: memory.createdAt ?? null,
    });
  }

  return entries;
}

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
