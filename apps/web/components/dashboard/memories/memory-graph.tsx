"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import type { Simulation, SimulationLinkDatum } from "d3-force";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tag,
  Eye,
  EyeOff,
  Network,
  X,
  Pin,
  Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildGraphData,
  shortLabel,
  type GraphNode,
  type GraphData,
} from "./graph-utils";

// ── Types ──────────────────────────────────────────────────────────────────

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

interface MemoryGraphProps {
  memories: SerializedMemory[];
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const NODE_RADIUS_MIN = 6;
const NODE_RADIUS_MAX = 20;
const HIT_PADDING = 4;
const ORANGE = "#F97316";
const ORANGE_DIM = "rgba(249, 115, 22, 0.3)";
const EDGE_COLOR = "rgba(249, 115, 22, 0.15)";
const EDGE_HIGHLIGHT = "rgba(249, 115, 22, 0.6)";
const GRID_COLOR = "rgba(255, 255, 255, 0.03)";
const BG_COLOR = "#0a0a0a";

// ── Helpers ────────────────────────────────────────────────────────────────

function nodeRadius(node: GraphNode): number {
  const t = Math.min(node.priority, 100) / 100;
  return NODE_RADIUS_MIN + t * (NODE_RADIUS_MAX - NODE_RADIUS_MIN);
}

function nodeColor(node: GraphNode): string {
  const t = Math.min(node.relevance, 100) / 100;
  const alpha = 0.3 + t * 0.7;
  return `rgba(249, 115, 22, ${alpha})`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function MemoryGraph({ memories }: MemoryGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<
    GraphNode,
    SimulationLinkDatum<GraphNode>
  > | null>(null);
  const animFrameRef = useRef<number>(0);

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  // Center the transform so forceCenter(0,0) maps to the middle of the canvas
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const selectedRef = useRef(selectedNode);
  selectedRef.current = selectedNode;
  const hoveredRef = useRef(hoveredNode);
  hoveredRef.current = hoveredNode;
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;
  const showOrphansRef = useRef(showOrphans);
  showOrphansRef.current = showOrphans;
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;
  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;

  // Drag state refs
  const dragNodeRef = useRef<GraphNode | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panTransformStartRef = useRef({ x: 0, y: 0 });

  // Build graph data from memories
  useEffect(() => {
    const data = buildGraphData(memories);
    setGraphData(data);
  }, [memories]);

  // Neighbor lookup for highlighting
  const neighborMap = useMemo(() => {
    if (!graphData) return new Map<string, Set<string>>();
    const map = new Map<string, Set<string>>();
    for (const e of graphData.edges) {
      if (!map.has(e.source)) map.set(e.source, new Set());
      if (!map.has(e.target)) map.set(e.target, new Set());
      map.get(e.source)!.add(e.target);
      map.get(e.target)!.add(e.source);
    }
    return map;
  }, [graphData]);

  const neighborMapRef = useRef(neighborMap);
  neighborMapRef.current = neighborMap;

  // Search match set
  const searchMatches = useMemo(() => {
    if (!searchQuery || !graphData) return null;
    const q = searchQuery.toLowerCase();
    return new Set(
      graphData.nodes
        .filter(
          (n) =>
            n.id.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q)),
        )
        .map((n) => n.id),
    );
  }, [searchQuery, graphData]);

  const searchMatchesRef = useRef(searchMatches);
  searchMatchesRef.current = searchMatches;

  // Node lookup map for O(1) edge rendering
  const nodeMapRef = useRef(new Map<string, GraphNode>());
  useEffect(() => {
    const map = new Map<string, GraphNode>();
    if (graphData) {
      for (const n of graphData.nodes) map.set(n.id, n);
    }
    nodeMapRef.current = map;
  }, [graphData]);

  // Canvas resize observer
  const initializedRef = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const w = Math.floor(width);
          const h = Math.floor(height);
          setCanvasSize({ w, h });
          // On first real size, center the transform
          if (!initializedRef.current) {
            initializedRef.current = true;
            setTransform({ x: w / 2, y: h / 2, k: 1 });
          }
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Update canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0 || canvasSize.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;
  }, [canvasSize]);

  // World-to-screen coordinate transform
  const worldToScreen = useCallback(
    (wx: number, wy: number, t: Transform) => ({
      x: wx * t.k + t.x,
      y: wy * t.k + t.y,
    }),
    [],
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, t: Transform) => ({
      x: (sx - t.x) / t.k,
      y: (sy - t.y) / t.k,
    }),
    [],
  );

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = graphDataRef.current;
    if (!data) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w === 0 || h === 0) return;
    const t = transformRef.current;
    const selected = selectedRef.current;
    const hovered = hoveredRef.current;
    const labels = showLabelsRef.current;
    const orphans = showOrphansRef.current;
    const matches = searchMatchesRef.current;
    const neighbors = neighborMapRef.current;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Dot grid
    const gridSpacing = 30 * t.k;
    if (gridSpacing > 5) {
      ctx.fillStyle = GRID_COLOR;
      const offsetX = t.x % gridSpacing;
      const offsetY = t.y % gridSpacing;
      for (let gx = offsetX; gx < w; gx += gridSpacing) {
        for (let gy = offsetY; gy < h; gy += gridSpacing) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }
    }

    const highlightNeighbors =
      (selected ?? hovered) ? neighbors.get((selected ?? hovered)!.id) : null;
    const highlightId = (selected ?? hovered)?.id ?? null;

    // Filter visible nodes
    const visibleNodes = orphans
      ? data.nodes
      : data.nodes.filter((n) => {
          const deg = (neighbors.get(n.id)?.size ?? 0) > 0;
          return deg;
        });
    const visibleSet = new Set(visibleNodes.map((n) => n.id));

    // Edges
    const nMap = nodeMapRef.current;
    for (const edge of data.edges) {
      const src = nMap.get(edge.source);
      const tgt = nMap.get(edge.target);
      if (!src || !tgt) continue;
      if (!visibleSet.has(src.id) || !visibleSet.has(tgt.id)) continue;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null)
        continue;

      const s = worldToScreen(src.x, src.y, t);
      const e = worldToScreen(tgt.x, tgt.y, t);

      const isHighlighted =
        highlightId != null &&
        (src.id === highlightId || tgt.id === highlightId);
      const isDimmed =
        matches != null && (!matches.has(src.id) || !matches.has(tgt.id));

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.strokeStyle = isDimmed
        ? "rgba(249, 115, 22, 0.04)"
        : isHighlighted
          ? EDGE_HIGHLIGHT
          : EDGE_COLOR;
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();
    }

    // Nodes
    for (const node of visibleNodes) {
      if (node.x == null || node.y == null) continue;
      const pos = worldToScreen(node.x, node.y, t);
      const r = nodeRadius(node) * t.k;
      const isSelected = selected?.id === node.id;
      const isHovered = hovered?.id === node.id;
      const isNeighbor = highlightNeighbors?.has(node.id) ?? false;
      const isMatch = matches == null || matches.has(node.id);
      const isDimmedBySearch = matches != null && !matches.has(node.id);
      const isDimmedByHighlight =
        highlightId != null && !isSelected && !isHovered && !isNeighbor;

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(
          pos.x,
          pos.y,
          r,
          pos.x,
          pos.y,
          r + 6,
        );
        glow.addColorStop(0, "rgba(249, 115, 22, 0.4)");
        glow.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      let alpha = 1;
      if (isDimmedBySearch) alpha = 0.12;
      else if (isDimmedByHighlight) alpha = 0.3;
      const baseColor = nodeColor(node);
      if (alpha < 1) {
        ctx.globalAlpha = alpha;
      }
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Pinned ring
      if (node.pinned) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = isMatch ? ORANGE : ORANGE_DIM;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Labels
      if (labels && t.k > 0.4) {
        const label = shortLabel(node.id);
        const fontSize = Math.max(8, Math.min(11, 10 * t.k));
        ctx.font = `${fontSize}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        let labelAlpha = 1;
        if (isDimmedBySearch) labelAlpha = 0.1;
        else if (isDimmedByHighlight) labelAlpha = 0.3;
        ctx.fillStyle =
          isSelected || isHovered
            ? ORANGE
            : `rgba(255, 255, 255, ${0.6 * labelAlpha})`;
        ctx.fillText(label, pos.x, pos.y + r + 4);
      }
    }

    ctx.restore();
  }, [worldToScreen]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Force simulation
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const sim = forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(
          graphData.edges.map((e) => ({ ...e })),
        )
          .id((d) => d.id)
          .distance(80),
      )
      .force(
        "charge",
        forceManyBody<GraphNode>().strength(
          graphData.nodes.length > 100 ? -80 : -200,
        ),
      )
      .force("center", forceCenter(0, 0))
      .force(
        "collide",
        forceCollide<GraphNode>((d) => nodeRadius(d) + 4),
      )
      .alphaDecay(0.02)
      .on("tick", () => {
        // drawing happens in the animation loop
      });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graphData]);

  // Fit all nodes to view
  const fitToView = useCallback(() => {
    if (!graphData || graphData.nodes.length === 0) return;
    const xs = graphData.nodes.map((n) => n.x ?? 0);
    const ys = graphData.nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 60;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const k = Math.min(
      (canvasSize.w - pad * 2) / rangeX,
      (canvasSize.h - pad * 2) / rangeY,
      2,
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({
      k,
      x: canvasSize.w / 2 - cx * k,
      y: canvasSize.h / 2 - cy * k,
    });
  }, [graphData, canvasSize]);

  // Auto-fit once we have both graph data and a real canvas size
  const didFitRef = useRef(false);
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0 || didFitRef.current) return;
    if (canvasSize.w === 0 || canvasSize.h === 0) return;
    // Wait a few simulation ticks so nodes have spread out from (0,0)
    const timer = setTimeout(() => {
      fitToView();
      didFitRef.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, [graphData, fitToView, canvasSize]);

  // Hit test: find node under screen coordinates
  const hitTest = useCallback(
    (sx: number, sy: number): GraphNode | null => {
      const data = graphDataRef.current;
      if (!data) return null;
      const t = transformRef.current;
      const world = screenToWorld(sx, sy, t);
      let closest: GraphNode | null = null;
      let closestDist = Infinity;
      for (const node of data.nodes) {
        if (node.x == null || node.y == null) continue;
        const dx = node.x - world.x;
        const dy = node.y - world.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = nodeRadius(node) + HIT_PADDING / t.k;
        if (dist < r && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      return closest;
    },
    [screenToWorld],
  );

  // Mouse handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const node = hitTest(sx, sy);

      if (node) {
        dragNodeRef.current = node;
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panTransformStartRef.current = {
          x: transformRef.current.x,
          y: transformRef.current.y,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [hitTest],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (dragNodeRef.current) {
        const t = transformRef.current;
        const world = screenToWorld(sx, sy, t);
        dragNodeRef.current.fx = world.x;
        dragNodeRef.current.fy = world.y;
        return;
      }

      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          x: panTransformStartRef.current.x + dx,
          y: panTransformStartRef.current.y + dy,
        }));
        return;
      }

      // Hover detection
      const node = hitTest(sx, sy);
      if (node !== hoveredRef.current) {
        setHoveredNode(node);
        if (node) {
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }
    },
    [hitTest, screenToWorld],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragNodeRef.current) {
        const node = dragNodeRef.current;
        node.fx = null;
        node.fy = null;
        simRef.current?.alphaTarget(0);
        dragNodeRef.current = null;

        // If not moved much, treat as click
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const hit = hitTest(sx, sy);
          if (hit && hit.id === node.id) {
            setSelectedNode((prev) => (prev?.id === node.id ? null : node));
          }
        }
      }
      isPanningRef.current = false;
    },
    [hitTest],
  );

  // Wheel zoom via native listener (passive: false to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;

      setTransform((prev) => {
        const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * factor));
        const ratio = newK / prev.k;
        return {
          k: newK,
          x: sx - (sx - prev.x) * ratio,
          y: sy - (sy - prev.y) * ratio,
        };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  const handleDoubleClick = useCallback(() => {
    fitToView();
  }, [fitToView]);

  // Navigate to a node (center + select)
  const navigateToNode = useCallback(
    (key: string) => {
      if (!graphData) return;
      const node = graphData.nodes.find((n) => n.id === key);
      if (!node || node.x == null || node.y == null) return;
      setSelectedNode(node);
      const t = transformRef.current;
      setTransform({
        k: t.k,
        x: canvasSize.w / 2 - node.x * t.k,
        y: canvasSize.h / 2 - node.y * t.k,
      });
    },
    [graphData, canvasSize],
  );

  // Zoom controls
  const zoomIn = useCallback(() => {
    setTransform((prev) => {
      const newK = Math.min(MAX_ZOOM, prev.k * 1.3);
      const ratio = newK / prev.k;
      const cx = canvasSize.w / 2;
      const cy = canvasSize.h / 2;
      return {
        k: newK,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  }, [canvasSize]);

  const zoomOut = useCallback(() => {
    setTransform((prev) => {
      const newK = Math.max(MIN_ZOOM, prev.k * 0.7);
      const ratio = newK / prev.k;
      const cx = canvasSize.w / 2;
      const cy = canvasSize.h / 2;
      return {
        k: newK,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      };
    });
  }, [canvasSize]);

  // Related keys for selected node
  const selectedRelated = useMemo(() => {
    if (!selectedNode || !neighborMap.has(selectedNode.id)) return [];
    return Array.from(neighborMap.get(selectedNode.id)!);
  }, [selectedNode, neighborMap]);

  // Empty state
  if (memories.length === 0) {
    return (
      <div className="dash-card flex flex-col items-center justify-center py-16 text-center">
        <Network className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
        <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
          No memories to visualize
        </p>
        <p className="text-xs text-[var(--landing-text-tertiary)]">
          Store some memories first, then come back to explore connections.
        </p>
      </div>
    );
  }

  if (graphData && graphData.edges.length === 0) {
    return (
      <div className="space-y-4">
        <div className="dash-card flex flex-col items-center justify-center py-12 text-center">
          <Link2 className="mb-3 h-8 w-8 text-[var(--landing-text-tertiary)]" />
          <p className="mb-1 font-mono text-sm font-medium text-[var(--landing-text)]">
            No relationships found
          </p>
          <p className="max-w-sm text-xs text-[var(--landing-text-tertiary)]">
            Memories exist but none have explicit links. Use{" "}
            <code className="rounded bg-[var(--landing-surface-2)] px-1 py-0.5">
              memory_advanced link
            </code>{" "}
            to create relationships between memories.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
          <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1">
            {graphData.nodes.length} nodes
          </span>
          <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1">
            0 edges
          </span>
          <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1">
            {graphData.orphans.length} orphans
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        {graphData && (
          <>
            <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {graphData.nodes.length} nodes
            </span>
            <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {graphData.edges.length} edges
            </span>
            <span className="rounded bg-[var(--landing-surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--landing-text-tertiary)]">
              {graphData.clusters.length} clusters
            </span>
          </>
        )}

        <div className="h-3 w-px bg-[var(--landing-border)]" />

        <div className="relative">
          <Search className="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-[var(--landing-text-tertiary)]" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-40 pl-7 font-mono text-[10px] sm:w-52"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2"
            >
              <X className="h-3 w-3 text-[var(--landing-text-tertiary)]" />
            </button>
          )}
        </div>

        <div className="h-3 w-px bg-[var(--landing-border)]" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fitToView}
            title="Fit to view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="h-3 w-px bg-[var(--landing-border)]" />

        <Button
          variant="ghost"
          size="sm"
          className={`h-7 gap-1 font-mono text-[10px] ${showLabels ? "text-[#F97316]" : ""}`}
          onClick={() => setShowLabels((v) => !v)}
        >
          <Tag className="h-3 w-3" />
          Labels
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 gap-1 font-mono text-[10px] ${showOrphans ? "text-[#F97316]" : ""}`}
          onClick={() => setShowOrphans((v) => !v)}
        >
          {showOrphans ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
          Orphans
        </Button>
      </div>

      {/* Canvas + detail panel layout */}
      <div className="flex flex-col gap-3 md:flex-row">
        {/* Canvas container */}
        <div
          ref={containerRef}
          className="dash-card relative min-h-[400px] flex-1 overflow-hidden p-0 md:min-h-[500px]"
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full cursor-crosshair"
            style={{ display: "block" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
          />

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredNode && !dragNodeRef.current && (
              <motion.div
                key={hoveredNode.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute z-20 max-w-[220px] rounded border border-[var(--landing-border)] bg-[var(--landing-surface)] px-2.5 py-1.5 shadow-lg"
                style={{
                  left: Math.min(tooltipPos.x + 12, canvasSize.w - 230),
                  top: Math.min(tooltipPos.y - 10, canvasSize.h - 80),
                }}
              >
                <p className="truncate font-mono text-[10px] font-medium text-[#F97316]">
                  {hoveredNode.id}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--landing-text-tertiary)]">
                  {hoveredNode.content.slice(0, 120)}
                  {hoveredNode.content.length > 120 ? "..." : ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key="detail-panel"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="dash-card w-full shrink-0 space-y-3 overflow-y-auto p-4 md:max-h-[500px] md:w-72"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs font-medium break-all text-[#F97316]">
                  {selectedNode.id}
                </p>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="shrink-0 text-[var(--landing-text-tertiary)] hover:text-[var(--landing-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <p className="mb-1 font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                  Content
                </p>
                <p className="text-xs leading-relaxed text-[var(--landing-text-secondary)]">
                  {selectedNode.content.slice(0, 200)}
                  {selectedNode.content.length > 200 ? "..." : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                    Priority
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--landing-surface-2)]">
                      <motion.div
                        className="h-full rounded-full bg-[#F97316]"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(selectedNode.priority, 100)}%`,
                        }}
                        transition={{
                          duration: 0.4,
                          ease: "easeOut",
                          delay: 0.1,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--landing-text-secondary)]">
                      {selectedNode.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                    Relevance
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--landing-surface-2)]">
                      <motion.div
                        className="h-full rounded-full bg-[#F97316]"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(selectedNode.relevance, 100)}%`,
                        }}
                        transition={{
                          duration: 0.4,
                          ease: "easeOut",
                          delay: 0.15,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[var(--landing-text-secondary)]">
                      {selectedNode.relevance.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-mono text-[var(--landing-text-tertiary)]">
                  Accessed {selectedNode.accessCount}x
                </span>
                {selectedNode.pinned && (
                  <Badge
                    variant="outline"
                    className="h-4 gap-0.5 border-[#F97316]/30 px-1 text-[10px] text-[#F97316]"
                  >
                    <Pin className="h-2.5 w-2.5" />
                    Pinned
                  </Badge>
                )}
              </div>

              {selectedNode.tags.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="h-4 px-1.5 font-mono text-[10px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedRelated.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] tracking-wider text-[var(--landing-text-tertiary)] uppercase">
                    Connected ({selectedRelated.length})
                  </p>
                  <div className="space-y-1">
                    {selectedRelated.map((key) => (
                      <button
                        key={key}
                        onClick={() => navigateToNode(key)}
                        className="block w-full truncate rounded bg-[var(--landing-surface-2)] px-2 py-1 text-left font-mono text-[10px] text-[var(--landing-text-secondary)] transition-colors hover:bg-[var(--landing-surface-2)]/80 hover:text-[#F97316]"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
