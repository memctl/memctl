import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBranchInfo } from "./agent-context.js";
import type { ApiClient } from "./api-client.js";

type HookAction = "start" | "turn" | "end";

type HookPayload = {
  action: HookAction;
  sessionId?: string;
  userMessage?: string;
  assistantMessage?: string;
  summary?: string;
  keysRead?: string[];
  keysWritten?: string[];
  toolsUsed?: string[];
  forceStore?: boolean;
};

type HookCandidate = {
  type:
    | "architecture"
    | "constraints"
    | "workflow"
    | "testing"
    | "lessons_learned"
    | "user_ideas"
    | "known_issues"
    | "decisions";
  title: string;
  content: string;
  id: string;
  priority: number;
  tags: string[];
  score: number;
};

type CliFlags = Record<string, string | boolean>;

const MAX_HOOK_CANDIDATES = 5;

function toArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug || "note";
}

function sanitizeLine(value: string): string {
  return value
    .replace(/^[-*]\s+/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/`+/g, "")
    .trim();
}

function splitLines(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => sanitizeLine(line))
    .filter((line) => line.length >= 20 && line.length <= 320);
}

function isGenericCapabilityNoise(content: string): boolean {
  const normalized = content.toLowerCase();
  const hasGenericCapabilityPhrase =
    /(scan(ning)? files?|search(ing)? (for )?patterns?|use (rg|ripgrep|grep)|read files?|find files?|use terminal commands?)/.test(
      normalized,
    );
  const hasProjectSpecificSignal =
    /[/_-]/.test(normalized) ||
    /\b[a-z0-9_-]+\.[a-z0-9_-]+\b/.test(normalized) ||
    /(api|schema|migration|component|endpoint|workflow|billing|auth|branch|test|typescript|next\.js|drizzle|turso|docker|mcp|file|function|module|config|page|layout|server|client|database|query|type|interface|class|method|middleware|handler|service|model|controller)/.test(
      normalized,
    );
  return hasGenericCapabilityPhrase && !hasProjectSpecificSignal;
}

function classifyCandidate(
  content: string,
): Pick<HookCandidate, "type" | "priority" | "tags" | "score"> | null {
  const text = content.toLowerCase();

  // Reject short conversational messages that lack actionable detail.
  // Real project knowledge has specifics (file names, error messages, steps).
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 8) return null;

  // Reject messages that are clearly questions or complaints without detail
  if (
    wordCount < 15 &&
    /^(what|why|how|is |are |do |does |can |could |where |when |any )/i.test(text.trim())
  ) return null;

  const hasDecision =
    /\b(decided|decision|chose|chosen|opted|selected|tradeoff|trade-off|approach)\b/.test(
      text,
    );
  const hasConstraint =
    /\b(must|must not|cannot|can't|do not|required|requirement|should not|only)\b/.test(
      text,
    );
  const hasOutcome =
    /\b(fixed|implemented|added|updated|refactored|migrated|resolved|shipped|created|removed|changed|modified|deleted|moved|renamed|replaced|configured|deployed|installed|fixing|implementing|adding|updating|creating|removing|changing|modifying|deleting|renaming|replacing|configuring|deploying)\b/.test(
      text,
    );
  const hasIssue =
    /\b(error|failed|failure|blocked|issue|bug|regression|not working|broke)\b/.test(
      text,
    );
  const hasTesting = /\b(test|coverage|assert|vitest|jest|e2e)\b/.test(text);
  const hasIdea =
    /\b(want to|should add|would be nice|idea:|feature request|enhancement|plan to add)\b/.test(
      text,
    );
  const hasKnownIssue =
    /\b(workaround|gotcha|caveat|known issue|breaks when|flaky|intermittent|hack:)\b/.test(
      text,
    );

  const hasProjectSignal =
    /[/_-]/.test(text) ||
    /\b[a-z0-9_-]+\.[a-z0-9_-]+\b/.test(text) ||
    /\b(api|route|schema|table|component|hook|migration|branch|mcp|build|ci|file|function|module|config|page|layout|server|client|database|endpoint|query|type|interface|class|method|middleware|handler|service|model|controller|template|style|store|provider)\b/.test(
      text,
    );

  if (!hasProjectSignal && !hasIssue) {
    return null;
  }

  let type: HookCandidate["type"] = "workflow";
  let priority = 60;
  let score = 0;
  const tags = ["hook:auto"];

  if (hasDecision) {
    type = "decisions";
    priority = 72;
    score += 4;
    tags.push("signal:decision");
  }
  if (hasConstraint) {
    type = "constraints";
    priority = 78;
    score += 4;
    tags.push("signal:constraint");
  }
  if (hasTesting) {
    type = "testing";
    priority = 68;
    score += 3;
    tags.push("signal:testing");
  }
  if (hasOutcome) {
    if (type === "workflow") {
      type = "workflow";
      priority = 66;
    }
    score += 3;
    tags.push("signal:outcome");
  }
  if (hasIdea) {
    type = "user_ideas";
    priority = 64;
    score += 3;
    tags.push("signal:idea");
  }
  if (hasKnownIssue) {
    type = "known_issues";
    priority = 76;
    score += 4;
    tags.push("signal:known-issue");
  }
  if (hasIssue) {
    type = "lessons_learned";
    priority = 82;
    score += 5;
    tags.push("signal:issue");
  }

  if (hasProjectSignal) score += 3;
  if (content.length > 150) score += 1;

  if (score < 5) return null;
  return { type, priority, tags, score };
}

function titleFromContent(content: string): string {
  const trimmed = content.replace(/\.$/, "");
  return trimmed.length <= 72 ? trimmed : `${trimmed.slice(0, 69)}...`;
}

export function extractHookCandidates(payload: {
  userMessage?: string;
  assistantMessage?: string;
  forceStore?: boolean;
}): HookCandidate[] {
  const forceStore = payload.forceStore === true;
  const source = [payload.userMessage, payload.assistantMessage]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join("\n");
  if (!source.trim()) return [];

  const lines = splitLines(source);
  const seen = new Set<string>();
  const candidates: HookCandidate[] = [];

  for (const line of lines) {
    if (!forceStore && isGenericCapabilityNoise(line)) continue;

    const normalized = line.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const classified = classifyCandidate(line);
    if (!classified) continue;

    const title = titleFromContent(line);
    candidates.push({
      ...classified,
      title,
      content: line,
      id: slugify(title),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_HOOK_CANDIDATES);
}

async function readStdinAll(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readSessionFile(): Promise<string | null> {
  try {
    const content = await readFile(
      join(".memctl", "hooks", "session_id"),
      "utf-8",
    );
    const id = content.trim();
    return id || null;
  } catch {
    return null;
  }
}

function generateFallbackSessionId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `hook-${now}-${rand}`;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

async function parseHookPayload(
  positional: string[],
  flags: CliFlags,
): Promise<HookPayload> {
  let base: Partial<HookPayload> = {};

  if (asBoolean(flags.stdin)) {
    const raw = await readStdinAll();
    if (raw.trim()) {
      base = JSON.parse(raw) as Partial<HookPayload>;
    }
  } else if (typeof flags.payload === "string" && flags.payload.trim()) {
    base = JSON.parse(flags.payload) as Partial<HookPayload>;
  }

  const action = (asString(positional[0]) ??
    asString(flags.action) ??
    base.action) as HookAction | undefined;
  if (!action || !["start", "turn", "end"].includes(action)) {
    throw new Error(
      "hook action is required. Use start, turn, or end (positional or --action).",
    );
  }

  const payload: HookPayload = {
    action,
    sessionId:
      asString(flags["session-id"]) ??
      asString(flags.sessionId) ??
      asString(base.sessionId),
    userMessage:
      asString(flags.user) ??
      asString(flags["user-message"]) ??
      asString(base.userMessage),
    assistantMessage:
      asString(flags.assistant) ??
      asString(flags["assistant-message"]) ??
      asString(base.assistantMessage),
    summary: asString(flags.summary) ?? asString(base.summary),
    keysRead: asString(flags["keys-read"])
      ? parseCsv(asString(flags["keys-read"]))
      : toArray(base.keysRead),
    keysWritten: asString(flags["keys-written"])
      ? parseCsv(asString(flags["keys-written"]))
      : toArray(base.keysWritten),
    toolsUsed: asString(flags["tools-used"])
      ? parseCsv(asString(flags["tools-used"]))
      : toArray(base.toolsUsed),
    forceStore: asBoolean(flags["force-store"]) || base.forceStore === true,
  };

  if (payload.keysRead && payload.keysRead.length === 0) payload.keysRead = [];
  if (payload.keysWritten && payload.keysWritten.length === 0)
    payload.keysWritten = [];
  if (payload.toolsUsed && payload.toolsUsed.length === 0) payload.toolsUsed = [];
  return payload;
}

function mergeUnique(first: string[] = [], second: string[] = []): string[] {
  return [...new Set([...first, ...second])];
}

async function getSessionSnapshot(client: ApiClient, sessionId: string): Promise<{
  keysRead: string[];
  keysWritten: string[];
  toolsUsed: string[];
}> {
  try {
    const logs = await client.getSessionLogs(50);
    const found = logs.sessionLogs.find((log) => log.sessionId === sessionId);
    if (!found) return { keysRead: [], keysWritten: [], toolsUsed: [] };
    return {
      keysRead: found.keysRead ? JSON.parse(found.keysRead) : [],
      keysWritten: found.keysWritten ? JSON.parse(found.keysWritten) : [],
      toolsUsed: found.toolsUsed ? JSON.parse(found.toolsUsed) : [],
    };
  } catch {
    return { keysRead: [], keysWritten: [], toolsUsed: [] };
  }
}

type ResolvedSession = {
  sessionId: string;
  source: "explicit" | "file" | "fallback";
};

async function resolveSessionId(explicit?: string): Promise<ResolvedSession> {
  if (explicit) {
    // Check if the explicit ID matches the file (MCP-managed)
    const fromFile = await readSessionFile();
    const source = fromFile === explicit ? "file" : "explicit";
    return { sessionId: explicit, source };
  }
  const fromFile = await readSessionFile();
  if (fromFile) return { sessionId: fromFile, source: "file" };
  return { sessionId: generateFallbackSessionId(), source: "fallback" };
}

function isMcpManaged(source: ResolvedSession["source"]): boolean {
  return source === "file";
}

async function handleHookStart(client: ApiClient, payload: HookPayload) {
  const resolved = await resolveSessionId(payload.sessionId);
  const managed = isMcpManaged(resolved.source);

  // MCP server already upserted this session, skip redundant work
  if (!managed) {
    const branchInfo = await getBranchInfo().catch(() => null);
    await client.upsertSessionLog({
      sessionId: resolved.sessionId,
      branch: branchInfo?.branch,
    });
    return {
      action: "start",
      sessionId: resolved.sessionId,
      branch: branchInfo?.branch ?? null,
      mcpManaged: false,
    };
  }

  return {
    action: "start",
    sessionId: resolved.sessionId,
    branch: null,
    mcpManaged: true,
  };
}

async function handleHookTurn(client: ApiClient, payload: HookPayload) {
  const resolved = await resolveSessionId(payload.sessionId);
  const candidates = extractHookCandidates({
    userMessage: payload.userMessage,
    assistantMessage: payload.assistantMessage,
    forceStore: payload.forceStore,
  });

  const storedKeys: string[] = [];
  const skippedAsDuplicate: string[] = [];
  const skippedAsLowSignal = candidates.length === 0;

  for (const candidate of candidates) {
    const key = `agent/context/${candidate.type}/hook_${candidate.id}`;
    let similarExists: boolean;
    try {
      const similar = await client.findSimilar(candidate.content, key, 0.88);
      similarExists = similar.similar.some((s) => s.similarity >= 0.9);
    } catch {
      similarExists = false;
    }
    if (similarExists) {
      skippedAsDuplicate.push(key);
      continue;
    }

    await client.storeMemory(
      key,
      candidate.content,
      {
        scope: "agent_functionality",
        type: candidate.type,
        id: `hook_${candidate.id}`,
        title: candidate.title,
        source: "hook.turn",
        capturedAt: new Date().toISOString(),
      },
      {
        priority: candidate.priority,
        tags: mergeUnique(candidate.tags, ["quality:high"]),
      },
    );
    storedKeys.push(key);
  }

  // Only update session log with hook data if there are keys to track
  if (storedKeys.length > 0 || (payload.keysRead?.length ?? 0) > 0 || (payload.keysWritten?.length ?? 0) > 0) {
    const current = await getSessionSnapshot(client, resolved.sessionId);
    await client.upsertSessionLog({
      sessionId: resolved.sessionId,
      keysRead: mergeUnique(current.keysRead, payload.keysRead ?? []),
      keysWritten: mergeUnique(current.keysWritten, [
        ...(payload.keysWritten ?? []),
        ...storedKeys,
      ]),
      toolsUsed: mergeUnique(current.toolsUsed, [
        ...(payload.toolsUsed ?? []),
        "hook.turn",
      ]),
    });
  }

  return {
    action: "turn",
    sessionId: resolved.sessionId,
    mcpManaged: isMcpManaged(resolved.source),
    extracted: candidates.length,
    stored: storedKeys.length,
    storedKeys,
    skippedAsDuplicate: skippedAsDuplicate.length,
    skippedAsLowSignal,
  };
}

async function handleHookEnd(client: ApiClient, payload: HookPayload) {
  const resolved = await resolveSessionId(payload.sessionId);
  const managed = isMcpManaged(resolved.source);

  // MCP server handles session finalization, skip closing here
  if (managed) {
    return {
      action: "end",
      sessionId: resolved.sessionId,
      summary: null,
      mcpManaged: true,
    };
  }

  const snapshot = await getSessionSnapshot(client, resolved.sessionId);
  const summary =
    payload.summary?.trim() ??
    `Hook session ended. ${snapshot.keysWritten.length} key(s) written, ${snapshot.keysRead.length} key(s) read.`;

  await client.upsertSessionLog({
    sessionId: resolved.sessionId,
    summary,
    keysRead: mergeUnique(snapshot.keysRead, payload.keysRead ?? []),
    keysWritten: mergeUnique(snapshot.keysWritten, payload.keysWritten ?? []),
    toolsUsed: mergeUnique(snapshot.toolsUsed, payload.toolsUsed ?? []),
    endedAt: Date.now(),
  });

  return {
    action: "end",
    sessionId: resolved.sessionId,
    summary,
    mcpManaged: false,
  };
}

export async function runHookCommand(input: {
  client: ApiClient;
  positional: string[];
  flags: CliFlags;
}): Promise<Record<string, unknown>> {
  const payload = await parseHookPayload(input.positional, input.flags);
  if (payload.action === "start") {
    return handleHookStart(input.client, payload);
  }
  if (payload.action === "turn") {
    return handleHookTurn(input.client, payload);
  }
  return handleHookEnd(input.client, payload);
}
