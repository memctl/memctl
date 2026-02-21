import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiClient } from "../../api-client.js";
import type { RateLimitState } from "../rate-limit.js";
import { textResponse, errorResponse, matchGlob } from "../response.js";
import {
  extractAgentContextEntries,
  getAllContextTypeInfo,
  getCustomContextTypes,
  listAllMemories,
} from "../../agent-context.js";

const execFileAsync = promisify(execFile);

export function registerMemoryAdvancedTool(server: McpServer, client: ApiClient, rl: RateLimitState) {
  server.tool(
    "memory_advanced",
    "Advanced memory operations. Actions: batch_mutate, snapshot_create, snapshot_list, diff, history, restore, link, traverse, graph, contradictions, quality, freshness, size_audit, sunset, undo, compile, change_digest, impact, watch, check_duplicates, auto_tag, validate_schema, branch_filter, branch_merge, batch_ops",
    {
      action: z.enum([
        "batch_mutate", "snapshot_create", "snapshot_list", "diff", "history",
        "restore", "link", "traverse", "graph", "contradictions", "quality",
        "freshness", "size_audit", "sunset", "undo", "compile", "change_digest",
        "impact", "watch", "check_duplicates", "auto_tag", "validate_schema",
        "branch_filter", "branch_merge", "batch_ops",
      ]).describe("Which operation to perform"),
      key: z.string().optional().describe("[diff,history,restore,traverse,impact,undo,auto_tag] Memory key"),
      keys: z.array(z.string()).optional().describe("[batch_mutate,watch] Memory keys"),
      mutateAction: z.enum(["archive","unarchive","delete","pin","unpin","set_priority","add_tags","set_scope"]).optional().describe("[batch_mutate] Action"),
      value: z.unknown().optional().describe("[batch_mutate] Value for the action"),
      name: z.string().optional().describe("[snapshot_create] Snapshot name"),
      description: z.string().optional().describe("[snapshot_create] Snapshot description"),
      limit: z.number().int().min(1).max(500).optional().describe("[snapshot_list,quality,size_audit,sunset,change_digest,history] Max results"),
      v1: z.number().int().min(1).optional().describe("[diff] First version"),
      v2: z.number().int().min(1).optional().describe("[diff] Second version"),
      version: z.number().int().min(1).optional().describe("[restore] Version to restore"),
      relatedKey: z.string().optional().describe("[link] Second memory key"),
      unlink: z.boolean().optional().describe("[link] true to remove link"),
      depth: z.number().int().min(1).max(5).optional().describe("[traverse] Max hops"),
      content: z.string().optional().describe("[check_duplicates] Content to check"),
      excludeKey: z.string().optional().describe("[check_duplicates] Exclude key"),
      threshold: z.number().min(0).max(1).optional().describe("[check_duplicates,size_audit] Threshold"),
      apply: z.boolean().optional().describe("[auto_tag] Apply tags"),
      type: z.string().optional().describe("[validate_schema] Context type"),
      branch: z.string().optional().describe("[branch_filter,branch_merge,compile] Branch name"),
      mergeAction: z.enum(["promote","archive"]).optional().describe("[branch_merge] Merge action"),
      dryRun: z.boolean().optional().describe("[branch_merge] Preview only"),
      since: z.number().optional().describe("[watch,change_digest] Unix timestamp"),
      steps: z.number().int().min(1).max(50).optional().describe("[undo] Steps back"),
      types: z.array(z.string()).optional().describe("[compile] Context types"),
      compileTags: z.array(z.string()).optional().describe("[compile] Filter by tags"),
      maxTokens: z.number().int().min(100).max(200000).optional().describe("[compile] Token budget"),
      format: z.enum(["markdown","condensed"]).optional().describe("[compile] Output format"),
      cachedHash: z.string().optional().describe("[freshness] Hash from previous check"),
      operations: z.array(z.object({
        method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
        path: z.string().describe("API path, e.g. /memories/my-key"),
        body: z.any().optional().describe("Request body for POST/PATCH"),
      })).optional().describe("[batch_ops] Array of API operations (max 20)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "batch_mutate": {
            const rateCheck = rl.checkRateLimit();
            if (!rateCheck.allowed) return errorResponse("Rate limit exceeded", rateCheck.warning!);
            rl.incrementWriteCount();
            if (!params.keys?.length) return errorResponse("Missing param", "keys required");
            if (!params.mutateAction) return errorResponse("Missing param", "mutateAction required");
            const result = await client.batchMutate(params.keys, params.mutateAction, params.value);
            const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
            return textResponse(`Batch ${params.mutateAction}: ${result.affected}/${result.matched} memories affected.${rateWarn}`);
          }
          case "snapshot_create": {
            if (!params.name) return errorResponse("Missing param", "name required");
            const result = await client.createSnapshot(params.name, params.description);
            return textResponse(`Snapshot "${params.name}" created with ${result.snapshot.memoryCount} memories. ID: ${result.snapshot.id}`);
          }
          case "snapshot_list": {
            const result = await client.listSnapshots(params.limit ?? 10);
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "diff": {
            if (!params.key || !params.v1) return errorResponse("Missing params", "key and v1 required");
            const result = await client.diffMemory(params.key, params.v1, params.v2);
            const diffText = result.diff.map((line) => {
              if (line.type === "add") return `+ ${line.line}`;
              if (line.type === "remove") return `- ${line.line}`;
              return `  ${line.line}`;
            }).join("\n");
            return textResponse(`Diff for "${params.key}" (${result.from} -> ${result.to}):\n+${result.summary.added} -${result.summary.removed} ~${result.summary.unchanged}\n\n${diffText}`);
          }
          case "history": {
            if (!params.key) return errorResponse("Missing param", "key required");
            const result = await client.getMemoryVersions(params.key, params.limit ?? 10);
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "restore": {
            if (!params.key || !params.version) return errorResponse("Missing params", "key and version required");
            const result = await client.restoreMemoryVersion(params.key, params.version);
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "link": {
            if (!params.key || !params.relatedKey) return errorResponse("Missing params", "key and relatedKey required");
            await client.linkMemories(params.key, params.relatedKey, params.unlink ?? false);
            return textResponse(`Memories ${params.unlink ? "unlinked" : "linked"}: "${params.key}" <-> "${params.relatedKey}"`);
          }
          case "traverse": {
            if (!params.key) return errorResponse("Missing param", "key required");
            const result = await client.traverseMemory(params.key, params.depth ?? 2);
            return textResponse(JSON.stringify(result, null, 2));
          }
          case "graph":
            return handleGraph(client);
          case "contradictions":
            return handleContradictions(client);
          case "quality":
            return handleQuality(client, params.limit ?? 30);
          case "freshness": {
            const result = await client.checkFreshness();
            const changed = params.cachedHash ? params.cachedHash !== result.hash : true;
            return textResponse(JSON.stringify({
              changed, hash: result.hash, memoryCount: result.memoryCount,
              latestUpdate: result.latestUpdate, checkedAt: result.checkedAt,
              message: changed ? "Context has changed. Use context bootstrap_delta to sync." : "No changes since last check.",
            }, null, 2));
          }
          case "size_audit":
            return handleSizeAudit(client, params.threshold ?? 4000);
          case "sunset":
            return handleSunset(client, params.limit ?? 20);
          case "undo": {
            if (!params.key) return errorResponse("Missing param", "key required");
            const result = await client.rollbackMemory(params.key, params.steps ?? 1);
            return textResponse(JSON.stringify({
              key: result.key, rolledBackTo: `version ${result.rolledBackTo}`,
              stepsBack: result.stepsBack, previousContent: result.previousContent,
              restoredContent: result.restoredContent,
              message: `Rolled back "${params.key}" by ${params.steps ?? 1} version(s).`,
            }, null, 2));
          }
          case "compile":
            return handleCompile(client, params);
          case "change_digest": {
            if (!params.since) return errorResponse("Missing param", "since required");
            const changes = await client.getChanges(params.since, params.limit ?? 100);
            return textResponse(JSON.stringify({
              timeRange: { from: new Date(changes.since).toISOString(), to: new Date(changes.until).toISOString() },
              summary: changes.summary, changes: changes.changes,
            }, null, 2));
          }
          case "impact": {
            if (!params.key) return errorResponse("Missing param", "key required");
            return handleImpact(client, params.key);
          }
          case "watch": {
            if (!params.keys?.length || !params.since) return errorResponse("Missing params", "keys and since required");
            const result = await client.watchMemories(params.keys, params.since);
            if (result.changed.length === 0) return textResponse(`No changes detected for ${params.keys.length} watched keys.`);
            return textResponse(JSON.stringify({ alert: `${result.changed.length} of ${params.keys.length} watched memories have been modified.`, ...result }, null, 2));
          }
          case "check_duplicates": {
            if (!params.content) return errorResponse("Missing param", "content required");
            const result = await client.findSimilar(params.content, params.excludeKey, params.threshold ?? 0.6);
            if (result.similar.length === 0) return textResponse("No duplicates found. Content is unique.");
            return textResponse(JSON.stringify({ warning: `Found ${result.similar.length} similar memories.`, similar: result.similar }, null, 2));
          }
          case "auto_tag": {
            if (!params.key) return errorResponse("Missing param", "key required");
            return handleAutoTag(client, params.key, params.apply ?? false);
          }
          case "validate_schema":
            return handleValidateSchema(client, params.type, params.key);
          case "branch_filter":
            return handleBranchFilter(client, params.branch);
          case "branch_merge": {
            if (!params.branch || !params.mergeAction) return errorResponse("Missing params", "branch and mergeAction required");
            return handleBranchMerge(client, rl, params.branch, params.mergeAction, params.dryRun ?? false);
          }
          case "batch_ops": {
            if (!params.operations?.length) return errorResponse("Missing param", "operations required (array, max 20)");
            if (params.operations.length > 20) return errorResponse("Too many operations", "Max 20 per batch");
            const result = await client.batch(params.operations);
            return textResponse(JSON.stringify(result, null, 2));
          }
          default:
            return errorResponse("Unknown action", params.action);
        }
      } catch (error) {
        return errorResponse(`Error in memory_advanced.${params.action}`, error);
      }
    },
  );
}

async function handleGraph(client: ApiClient) {
  const allMemories = await listAllMemories(client);
  const adjacency: Record<string, string[]> = {};
  const allKeys = new Set<string>();
  for (const mem of allMemories) {
    allKeys.add(mem.key);
    let related: string[] = [];
    if (mem.relatedKeys) { try { related = JSON.parse(mem.relatedKeys as string); } catch {} }
    adjacency[mem.key] = related.filter((k) => k !== mem.key);
  }

  const nodes = Array.from(allKeys);
  const edges: Array<{ from: string; to: string }> = [];
  const undirected: Record<string, Set<string>> = {};
  for (const key of nodes) undirected[key] = new Set();
  for (const [from, tos] of Object.entries(adjacency)) {
    for (const to of tos) {
      if (allKeys.has(to)) {
        edges.push({ from, to });
        undirected[from]!.add(to);
        undirected[to]!.add(from);
      }
    }
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];
  for (const node of nodes) {
    if (visited.has(node)) continue;
    const neighbors = undirected[node];
    if (!neighbors || neighbors.size === 0) continue;
    const cluster: string[] = [];
    const queue = [node];
    visited.add(node);
    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      for (const neighbor of undirected[current] ?? []) {
        if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
      }
    }
    clusters.push(cluster);
  }

  const orphans = nodes.filter((n) => !visited.has(n));

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color: Record<string, number> = {};
  for (const n of nodes) color[n] = WHITE;
  const cycles: string[][] = [];
  function dfs(node: string, path: string[]) {
    color[node] = GRAY;
    path.push(node);
    for (const neighbor of adjacency[node] ?? []) {
      if (!allKeys.has(neighbor)) continue;
      if (color[neighbor] === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
      } else if (color[neighbor] === WHITE) {
        dfs(neighbor, path);
      }
    }
    path.pop();
    color[node] = BLACK;
  }
  for (const node of nodes) { if (color[node] === WHITE) dfs(node, []); }

  return textResponse(JSON.stringify({
    totalNodes: nodes.length, totalEdges: edges.length,
    clusters: clusters.map((c, i) => ({ id: i, size: c.length, keys: c })),
    orphans, cycles, adjacency,
    hint: cycles.length > 0 ? `Found ${cycles.length} cycle(s).` : orphans.length > 0 ? `${orphans.length} memories have no relationships.` : "Memory graph is healthy.",
  }, null, 2));
}

async function handleContradictions(client: ApiClient) {
  const allMemories = await listAllMemories(client);
  interface Directive { key: string; verb: string; subject: string; snippet: string; }
  const directives: Directive[] = [];
  const patterns = [
    /\b(use|prefer|always use|choose|require)\s+(\w[\w\s.-]{0,30}\w)/gi,
    /\b(avoid|never use|don't use|do not use|never)\s+(\w[\w\s.-]{0,30}\w)/gi,
    /\b(always|must|should always)\s+(\w[\w\s.-]{0,30}\w)/gi,
    /\b(never|must not|should never|don't|do not)\s+(\w[\w\s.-]{0,30}\w)/gi,
  ];
  for (const mem of allMemories) {
    const content = mem.content ?? "";
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const verb = match[1]!.toLowerCase();
        const subject = match[2]!.toLowerCase().trim();
        if (subject.length < 3) continue;
        const lineStart = content.lastIndexOf("\n", match.index) + 1;
        const lineEnd = content.indexOf("\n", match.index);
        const snippet = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim().slice(0, 120);
        directives.push({ key: mem.key, verb, subject, snippet });
      }
    }
  }

  const positiveVerbs = new Set(["use","prefer","always use","choose","require","always","must","should always"]);
  const negativeVerbs = new Set(["avoid","never use","don't use","do not use","never","must not","should never","don't","do not"]);
  interface Conflict { memoryA: string; snippetA: string; memoryB: string; snippetB: string; subject: string; confidence: number; }
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < directives.length; i++) {
    for (let j = i + 1; j < directives.length; j++) {
      const a = directives[i]!; const b = directives[j]!;
      if (a.key === b.key) continue;
      const subjectOverlap = a.subject === b.subject || a.subject.includes(b.subject) || b.subject.includes(a.subject);
      if (!subjectOverlap) continue;
      const aPositive = positiveVerbs.has(a.verb); const aNegative = negativeVerbs.has(a.verb);
      const bPositive = positiveVerbs.has(b.verb); const bNegative = negativeVerbs.has(b.verb);
      if ((aPositive && bNegative) || (aNegative && bPositive)) {
        const conflictKey = [a.key, b.key].sort().join("|") + "|" + a.subject;
        if (seen.has(conflictKey)) continue;
        seen.add(conflictKey);
        conflicts.push({ memoryA: a.key, snippetA: a.snippet, memoryB: b.key, snippetB: b.snippet, subject: a.subject, confidence: a.subject === b.subject ? 0.9 : 0.6 });
      }
    }
  }
  conflicts.sort((a, b) => b.confidence - a.confidence);
  return textResponse(JSON.stringify({
    directivesFound: directives.length, contradictions: conflicts.length,
    conflicts: conflicts.slice(0, 20),
    hint: conflicts.length > 0 ? `Found ${conflicts.length} potential contradictions.` : "No contradictions detected.",
  }, null, 2));
}

async function handleQuality(client: ApiClient, limit: number) {
  const allMemories = await listAllMemories(client);
  const scored = allMemories.map((mem) => {
    const content = mem.content ?? "";
    const len = content.length;
    const issues: string[] = [];
    let score = 100;
    if (len < 50) { score -= 30; issues.push("Very short content."); }
    else if (len < 150) { score -= 10; issues.push("Short content."); }
    const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
    const hasBullets = /^[-*]\s+/m.test(content);
    if (len > 500 && headings.length === 0 && !hasBullets) { score -= 15; issues.push("Long unstructured content."); }
    const helpful = mem.helpfulCount ?? 0; const unhelpful = mem.unhelpfulCount ?? 0;
    if (helpful + unhelpful >= 3 && unhelpful > helpful) { score -= 25; issues.push(`Negative feedback (${helpful}/${unhelpful}).`); }
    const lastAccess = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
    if (lastAccess) {
      const daysSince = (Date.now() - lastAccess) / 86_400_000;
      if (daysSince > 60) { score -= 20; issues.push(`Not accessed in ${Math.round(daysSince)} days.`); }
      else if (daysSince > 30) { score -= 10; issues.push(`Not accessed in ${Math.round(daysSince)} days.`); }
    }
    if (/TODO|FIXME|PLACEHOLDER|TBD/i.test(content)) { score -= 15; issues.push("Contains TODO/FIXME markers."); }
    return { key: mem.key, qualityScore: Math.max(0, score), issues, contentLength: len, priority: mem.priority ?? 0, accessCount: mem.accessCount ?? 0 };
  });
  scored.sort((a, b) => a.qualityScore - b.qualityScore);
  const results = scored.slice(0, limit);
  const lowQuality = results.filter((m) => m.qualityScore < 50);
  return textResponse(JSON.stringify({
    totalMemories: allMemories.length, analyzed: results.length, lowQualityCount: lowQuality.length,
    averageQuality: Math.round(scored.reduce((s, m) => s + m.qualityScore, 0) / (scored.length || 1)),
    memories: results,
  }, null, 2));
}

async function handleSizeAudit(client: ApiClient, threshold: number) {
  const allMemories = await listAllMemories(client);
  const CHARS_PER_TOKEN = 4;
  const oversized = allMemories
    .filter((m) => (m.content?.length ?? 0) > threshold)
    .map((m) => {
      const len = m.content?.length ?? 0;
      const tokenEst = Math.ceil(len / CHARS_PER_TOKEN);
      const headings = (m.content ?? "").match(/^#{1,3}\s+.+$/gm) ?? [];
      return { key: m.key, chars: len, tokenEstimate: tokenEst, headingsCount: headings.length, canSplit: headings.length >= 2 };
    })
    .sort((a, b) => b.chars - a.chars);
  const totalTokens = allMemories.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / CHARS_PER_TOKEN), 0);
  const oversizedTokens = oversized.reduce((sum, m) => sum + m.tokenEstimate, 0);
  return textResponse(JSON.stringify({
    totalMemories: allMemories.length, totalTokenEstimate: totalTokens,
    oversizedCount: oversized.length, oversizedTokenEstimate: oversizedTokens,
    oversizedPercentage: totalTokens > 0 ? Math.round((oversizedTokens / totalTokens) * 100) : 0,
    oversized,
  }, null, 2));
}

async function handleSunset(client: ApiClient, limit: number) {
  const allMemories = await listAllMemories(client);
  let currentBranches = new Set<string>();
  try { const { stdout } = await execFileAsync("git", ["branch", "--format=%(refname:short)"]); currentBranches = new Set(stdout.trim().split("\n").filter(Boolean)); } catch {}
  let trackedFiles = new Set<string>();
  try { const { stdout } = await execFileAsync("git", ["ls-files"]); trackedFiles = new Set(stdout.trim().split("\n").filter(Boolean)); } catch {}

  const now = Date.now();
  const suggestions: Array<{ key: string; score: number; reasons: string[]; priority: number; lastAccessedAt: string | null }> = [];
  for (const mem of allMemories) {
    if (mem.archivedAt) continue;
    let score = 0; const reasons: string[] = [];
    let tags: string[] = [];
    try { tags = JSON.parse(mem.tags as string ?? "[]"); } catch {}
    const branchTag = tags.find((t) => t.startsWith("branch:"));
    if (branchTag) {
      const branchName = branchTag.replace("branch:", "");
      if (currentBranches.size > 0 && !currentBranches.has(branchName)) { score += 40; reasons.push(`Branch "${branchName}" no longer exists`); }
    }
    const content = mem.content ?? "";
    const fileRefs = content.match(/(?:^|\s)([\w./\-]+\.\w{1,10})/gm) ?? [];
    const missingFiles = fileRefs.map((f) => f.trim()).filter((f) => trackedFiles.size > 0 && !trackedFiles.has(f) && f.includes("/"));
    if (missingFiles.length > 0) { score += 30; reasons.push(`References ${missingFiles.length} file(s) no longer in repo`); }
    const lastAccess = mem.lastAccessedAt ? new Date(mem.lastAccessedAt as string).getTime() : 0;
    if (!lastAccess && mem.accessCount === 0) { score += 25; reasons.push("Never accessed"); }
    else if (lastAccess) { const daysSince = (now - lastAccess) / 86_400_000; if (daysSince > 90) { score += 20; reasons.push(`Not accessed in ${Math.round(daysSince)} days`); } }
    const helpful = mem.helpfulCount ?? 0; const unhelpful = mem.unhelpfulCount ?? 0;
    if (unhelpful > helpful && (helpful + unhelpful) >= 2) { score += 20; reasons.push(`Negative feedback`); }
    const priority = mem.priority ?? 0;
    const createdAt = mem.createdAt ? new Date(mem.createdAt as string).getTime() : 0;
    if (priority === 0 && createdAt && (now - createdAt) / 86_400_000 > 60) { score += 10; reasons.push("Low priority and older than 60 days"); }
    if (score > 0) suggestions.push({ key: mem.key, score, reasons, priority, lastAccessedAt: lastAccess ? new Date(lastAccess).toISOString() : null });
  }
  suggestions.sort((a, b) => b.score - a.score);
  return textResponse(JSON.stringify({ totalMemories: allMemories.length, suggestions: suggestions.slice(0, limit).length, items: suggestions.slice(0, limit) }, null, 2));
}

async function handleCompile(client: ApiClient, params: Record<string, unknown>) {
  const allMemories = await listAllMemories(client);
  const entries = extractAgentContextEntries(allMemories);
  const allTypeInfo = await getAllContextTypeInfo(client);
  const types = params.types as string[] | undefined;
  const tags = params.compileTags as string[] | undefined;
  const branch = params.branch as string | undefined;
  const maxTokens = (params.maxTokens as number) ?? 16000;
  const format = (params.format as string) ?? "markdown";

  let filtered = entries;
  if (types) filtered = filtered.filter((e) => types.includes(e.type));
  if (tags) filtered = filtered.filter((e) => tags.some((t) => e.tags.includes(t)));
  if (branch) {
    const branchTag = `branch:${branch}`;
    filtered = filtered.filter((e) => { const hasBranchTag = e.tags.some((t) => t.startsWith("branch:")); return e.tags.includes(branchTag) || !hasBranchTag; });
  }
  filtered.sort((a, b) => b.priority - a.priority);

  const CHARS_PER_TOKEN = 4;
  let budgetChars = maxTokens * CHARS_PER_TOKEN;
  const selected: typeof filtered = [];
  for (const entry of filtered) {
    if (entry.content.length <= budgetChars) { selected.push(entry); budgetChars -= entry.content.length; }
    if (budgetChars <= 0) break;
  }

  const byType: Record<string, typeof selected> = {};
  for (const entry of selected) { if (!byType[entry.type]) byType[entry.type] = []; byType[entry.type].push(entry); }

  if (format === "condensed") {
    const parts: string[] = [];
    for (const [type, typeEntries] of Object.entries(byType)) {
      parts.push(`[${allTypeInfo[type]?.label ?? type}]`);
      for (const e of typeEntries) parts.push(e.content);
      parts.push("");
    }
    return textResponse(parts.join("\n"));
  }

  const lines: string[] = ["# Compiled Memory Context", ""];
  lines.push("## Table of Contents");
  for (const [type] of Object.entries(byType)) lines.push(`- [${allTypeInfo[type]?.label ?? type}](#${type})`);
  lines.push("");
  for (const [type, typeEntries] of Object.entries(byType)) {
    lines.push(`## ${allTypeInfo[type]?.label ?? type}`);
    lines.push("");
    for (const e of typeEntries) {
      if (typeEntries.length > 1) { lines.push(`### ${e.title}`); lines.push(""); }
      lines.push(e.content); lines.push("");
    }
  }
  const totalTokens = selected.reduce((sum, e) => sum + Math.ceil(e.content.length / CHARS_PER_TOKEN), 0);
  return textResponse(`${lines.join("\n")}\n---\n_Compiled ${selected.length} entries (~${totalTokens} tokens)._`);
}

async function handleImpact(client: ApiClient, key: string) {
  const allMemories = await listAllMemories(client);
  const keyLower = key.toLowerCase();
  const impacted = allMemories.filter((m) => {
    if (m.key === key) return false;
    const content = (m.content ?? "").toLowerCase();
    const relatedKeys = (m.relatedKeys ?? "").toLowerCase();
    const metadata = typeof m.metadata === "string" ? m.metadata.toLowerCase() : "";
    return content.includes(keyLower) || relatedKeys.includes(keyLower) || metadata.includes(keyLower);
  }).map((m) => {
    const referenceTypes: string[] = [];
    if ((m.content ?? "").toLowerCase().includes(keyLower)) referenceTypes.push("content");
    if ((m.relatedKeys ?? "").toLowerCase().includes(keyLower)) referenceTypes.push("relatedKeys");
    if (typeof m.metadata === "string" && m.metadata.toLowerCase().includes(keyLower)) referenceTypes.push("metadata");
    return { key: m.key, referenceTypes, priority: m.priority ?? 0, contentPreview: (m.content ?? "").slice(0, 120) };
  });
  return textResponse(JSON.stringify({
    analyzedKey: key, impactedCount: impacted.length, impacted,
    hint: impacted.length > 0 ? `${impacted.length} memories reference "${key}".` : `No other memories reference "${key}". Safe to modify or delete.`,
  }, null, 2));
}

async function handleAutoTag(client: ApiClient, key: string, apply: boolean) {
  const mem = await client.getMemory(key) as { memory?: { content?: string; tags?: string } };
  if (!mem?.memory?.content) return errorResponse("Error auto-tagging", "Memory not found or empty");
  const content = mem.memory.content.toLowerCase();
  const suggestedTags: string[] = [];
  const techPatterns: Record<string, string[]> = {
    react: ["react","jsx","tsx","usestate","useeffect","component"],
    nextjs: ["next.js","nextjs","app router","server component"],
    typescript: ["typescript",".ts",".tsx","interface ","type "],
    python: ["python",".py","def ","import ","pip"],
    database: ["database","sql","query","schema","migration","drizzle","prisma"],
    api: ["api","endpoint","rest","graphql","route","handler"],
    testing: ["test","jest","vitest","playwright","cypress","assert"],
    auth: ["auth","login","session","token","jwt","oauth"],
    security: ["security","xss","csrf","injection","sanitize"],
  };
  for (const [tag, keywords] of Object.entries(techPatterns)) {
    if (keywords.some((kw) => content.includes(kw))) suggestedTags.push(tag);
  }
  if (content.includes("frontend") || content.includes("ui") || content.includes("component")) suggestedTags.push("frontend");
  if (content.includes("backend") || content.includes("server") || content.includes("api")) suggestedTags.push("backend");
  if (content.includes("performance") || content.includes("optimize") || content.includes("cache")) suggestedTags.push("performance");
  const uniqueTags = [...new Set(suggestedTags)];
  if (apply && uniqueTags.length > 0) {
    let existingTags: string[] = [];
    if (mem.memory.tags) { try { existingTags = JSON.parse(mem.memory.tags); } catch {} }
    const merged = [...new Set([...existingTags, ...uniqueTags])];
    await client.updateMemory(key, undefined, undefined, { tags: merged });
    return textResponse(`Auto-tagged "${key}" with: ${uniqueTags.join(", ")}.`);
  }
  return textResponse(JSON.stringify({ key, suggestedTags: uniqueTags, applied: false }, null, 2));
}

async function handleValidateSchema(client: ApiClient, type?: string, key?: string) {
  const allMemories = await listAllMemories(client);
  const customTypes = await getCustomContextTypes(client);
  const typesWithSchemas = customTypes.filter((t) => t.schema);
  if (typesWithSchemas.length === 0) return textResponse(JSON.stringify({ validated: 0, valid: 0, invalid: 0, issues: [], hint: "No custom types with schemas." }, null, 2));

  const entries = extractAgentContextEntries(allMemories);
  let filtered = entries;
  if (type) filtered = filtered.filter((e) => e.type === type);
  if (key) filtered = filtered.filter((e) => e.key === key);

  const issues: Array<{ key: string; type: string; errors: string[] }> = [];
  for (const entry of filtered) {
    const ctType = typesWithSchemas.find((t) => t.slug === entry.type);
    if (!ctType?.schema) continue;
    let schema: Record<string, unknown>;
    try { schema = JSON.parse(ctType.schema); } catch { continue; }
    const entryErrors: string[] = [];
    const requiredFields = (schema.required as string[]) ?? [];
    const properties = (schema.properties as Record<string, { type?: string }>) ?? {};
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(entry.content); } catch {
      if (Object.keys(properties).length > 0) {
        const headings = entry.content.match(/^#{1,6}\s+(.+)$/gm)?.map((h) => h.replace(/^#{1,6}\s+/, "").trim().toLowerCase()) ?? [];
        for (const req of requiredFields) { if (!headings.some((h) => h.includes(req.toLowerCase()))) entryErrors.push(`Missing required section: "${req}"`); }
      }
    }
    if (parsed && typeof parsed === "object") {
      for (const req of requiredFields) { if (!(req in parsed) || parsed[req] == null) entryErrors.push(`Missing required field: "${req}"`); }
      for (const [prop, def] of Object.entries(properties)) {
        if (prop in parsed && def.type) {
          const actual = Array.isArray(parsed[prop]) ? "array" : typeof parsed[prop];
          if (actual !== def.type) entryErrors.push(`Field "${prop}" should be ${def.type}, got ${actual}`);
        }
      }
    }
    if (entryErrors.length > 0) issues.push({ key: entry.key, type: entry.type, errors: entryErrors });
  }
  const validated = filtered.filter((e) => typesWithSchemas.some((t) => t.slug === e.type)).length;
  return textResponse(JSON.stringify({ validated, valid: validated - issues.length, invalid: issues.length, issues }, null, 2));
}

async function handleBranchFilter(client: ApiClient, branch?: string) {
  const allMemories = await listAllMemories(client);
  if (branch) {
    const branchTag = `branch:${branch}`;
    const branchMemories = allMemories.filter((m) => {
      try { const tags = JSON.parse(m.tags ?? "[]") as string[]; return tags.includes(branchTag); } catch { return false; }
    });
    return textResponse(JSON.stringify({ branch, count: branchMemories.length, memories: branchMemories.map((m) => ({ key: m.key, priority: m.priority, updatedAt: m.updatedAt, contentPreview: (m.content ?? "").slice(0, 120) })) }, null, 2));
  }
  const branchCounts: Record<string, number> = {};
  let globalCount = 0;
  for (const m of allMemories) {
    let tags: string[] = [];
    try { tags = JSON.parse(m.tags ?? "[]") as string[]; } catch {}
    const branchTags = tags.filter((t) => t.startsWith("branch:"));
    if (branchTags.length === 0) globalCount++;
    else for (const bt of branchTags) { const name = bt.replace("branch:", ""); branchCounts[name] = (branchCounts[name] ?? 0) + 1; }
  }
  return textResponse(JSON.stringify({ globalCount, branches: Object.entries(branchCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ branch: name, count })), totalMemories: allMemories.length }, null, 2));
}

async function handleBranchMerge(client: ApiClient, rl: RateLimitState, branch: string, action: string, dryRun: boolean) {
  const rateCheck = rl.checkRateLimit();
  if (!rateCheck.allowed && !dryRun) return errorResponse("Rate limit exceeded", rateCheck.warning!);
  const allMemories = await listAllMemories(client);
  const branchTag = `branch:${branch}`;
  const branchMemories = allMemories.filter((mem) => {
    if (!mem.tags) return false;
    try { return (JSON.parse(mem.tags as string) as string[]).includes(branchTag); } catch { return false; }
  });
  if (branchMemories.length === 0) return textResponse(JSON.stringify({ branch, action, found: 0, affected: 0, message: `No memories with tag "${branchTag}".` }, null, 2));
  if (dryRun) return textResponse(JSON.stringify({ branch, action, dryRun: true, found: branchMemories.length, keys: branchMemories.map((m) => m.key) }, null, 2));

  let affected = 0;
  if (action === "promote") {
    for (const mem of branchMemories) {
      let tags: string[] = [];
      try { tags = JSON.parse(mem.tags as string); } catch {}
      await client.updateMemory(mem.key, undefined, undefined, { tags: tags.filter((t) => t !== branchTag) });
      rl.incrementWriteCount();
      affected++;
    }
  } else {
    const keys = branchMemories.map((m) => m.key);
    const result = await client.batchMutate(keys, "archive") as { affected: number };
    rl.incrementWriteCount();
    affected = result.affected;
  }
  const rateWarn = rateCheck.warning ? ` ${rateCheck.warning}` : "";
  return textResponse(JSON.stringify({ branch, action, found: branchMemories.length, affected, message: `${action === "promote" ? "Promoted" : "Archived"} ${affected} memories.${rateWarn}` }, null, 2));
}
