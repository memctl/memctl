import type { SimulationNodeDatum } from "d3-force";
import { computeRelevanceScore } from "@memctl/shared";

interface SerializedMemory {
  id: string;
  key: string;
  content: string;
  priority: number | null;
  tags: string | null;
  pinnedAt: string | number | null;
  archivedAt: string | number | null;
  accessCount?: number;
  lastAccessedAt?: string | number | null;
  helpfulCount?: number;
  unhelpfulCount?: number;
  relatedKeys?: string | null;
  [key: string]: unknown;
}

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  content: string;
  priority: number;
  tags: string[];
  accessCount: number;
  pinned: boolean;
  archived: boolean;
  relevance: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "explicit";
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: string[][];
  orphans: string[];
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
  } catch {
    // ignore
  }
  return [];
}

function toTimestamp(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const ms = new Date(val).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function buildGraphData(memories: SerializedMemory[]): GraphData {
  const now = Date.now();
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const m of memories) {
    const relevance = computeRelevanceScore(
      {
        priority: m.priority ?? 0,
        accessCount: m.accessCount ?? 0,
        lastAccessedAt: toTimestamp(m.lastAccessedAt),
        helpfulCount: m.helpfulCount ?? 0,
        unhelpfulCount: m.unhelpfulCount ?? 0,
        pinnedAt: toTimestamp(m.pinnedAt),
      },
      now,
    );

    nodeMap.set(m.key, {
      id: m.key,
      content: m.content,
      priority: m.priority ?? 0,
      tags: parseJsonArray(m.tags),
      accessCount: m.accessCount ?? 0,
      pinned: m.pinnedAt != null,
      archived: m.archivedAt != null,
      relevance,
    });
  }

  for (const m of memories) {
    const related = parseJsonArray(m.relatedKeys as string | null);
    for (const targetKey of related) {
      if (!nodeMap.has(targetKey)) continue;
      const edgeKey = [m.key, targetKey].sort().join("\0");
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);
      edges.push({ source: m.key, target: targetKey, type: "explicit" });
    }
  }

  const nodes = Array.from(nodeMap.values());
  const clusters = detectClusters(nodes, edges);
  const connectedKeys = new Set(edges.flatMap((e) => [e.source, e.target]));
  const orphans = nodes.filter((n) => !connectedKeys.has(n.id)).map((n) => n.id);

  return { nodes, edges, clusters, orphans };
}

export function detectClusters(
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[][] {
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const n of nodes) {
    parent.set(n.id, n.id);
    rank.set(n.id, 0);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra)!;
    const rankB = rank.get(rb)!;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  for (const e of edges) {
    union(e.source, e.target);
  }

  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const root = find(n.id);
    let group = groups.get(root);
    if (!group) {
      group = [];
      groups.set(root, group);
    }
    group.push(n.id);
  }

  return Array.from(groups.values()).filter((g) => g.length > 1);
}

export function shortLabel(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] ?? key;
}
